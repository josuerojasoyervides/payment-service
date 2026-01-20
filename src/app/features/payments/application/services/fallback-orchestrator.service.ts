import { inject, Injectable, InjectionToken, signal, computed } from '@angular/core';
import { Subject, timer, takeUntil, filter } from 'rxjs';
import { 
    PaymentProviderId,
    PaymentError,
    CreatePaymentRequest,
    FallbackAvailableEvent,
    FallbackUserResponse,
    FallbackState,
    FallbackConfig,
    FallbackStatus,
    FailedAttempt,
    DEFAULT_FALLBACK_CONFIG,
    INITIAL_FALLBACK_STATE,
} from '../../domain/models';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Token para inyectar configuración del fallback.
 */
export const FALLBACK_CONFIG = new InjectionToken<Partial<FallbackConfig>>('FALLBACK_CONFIG');

/**
 * Servicio de orquestación de fallback entre proveedores.
 * 
 * Este servicio detecta fallos en proveedores de pago y puede:
 * - Modo manual: Notificar a la UI para que el usuario decida
 * - Modo automático: Ejecutar fallback automáticamente sin intervención
 * 
 * Flujo Manual:
 * 1. Pago falla con provider A
 * 2. FallbackOrchestrator emite evento con alternativas
 * 3. UI muestra modal/notificación al usuario
 * 4. Usuario confirma o cancela
 * 5. Si confirma, se notifica al componente para reintentar
 * 
 * Flujo Automático:
 * 1. Pago falla con provider A
 * 2. FallbackOrchestrator espera autoFallbackDelay
 * 3. Automáticamente ejecuta con siguiente provider
 * 4. Si también falla y hay más providers, repite
 * 5. Después de maxAutoFallbacks, cambia a modo manual
 * 
 * @example
 * ```typescript
 * // Configurar modo automático
 * { provide: FALLBACK_CONFIG, useValue: { mode: 'auto', autoFallbackDelay: 2000 } }
 * 
 * // En el componente
 * fallbackOrchestrator.fallbackExecute$.subscribe(({ request, provider }) => {
 *   this.store.startPayment({ request, providerId: provider });
 * });
 * ```
 */
@Injectable()
export class FallbackOrchestratorService {
    private readonly config: FallbackConfig;
    private readonly registry = inject(ProviderFactoryRegistry);

    // Estado reactivo
    private readonly _state = signal<FallbackState>(INITIAL_FALLBACK_STATE);
    
    // Subjects para eventos
    private readonly _fallbackAvailable$ = new Subject<FallbackAvailableEvent>();
    private readonly _userResponse$ = new Subject<FallbackUserResponse>();
    private readonly _fallbackExecute$ = new Subject<{ request: CreatePaymentRequest; provider: PaymentProviderId }>();
    private readonly _autoFallbackStarted$ = new Subject<{ provider: PaymentProviderId; delay: number }>();
    private readonly _cancel$ = new Subject<void>();

    // Observables públicos
    readonly fallbackAvailable$ = this._fallbackAvailable$.asObservable();
    readonly userResponse$ = this._userResponse$.asObservable();
    readonly fallbackExecute$ = this._fallbackExecute$.asObservable();
    
    /** Emitido cuando se inicia un auto-fallback (para mostrar feedback en UI) */
    readonly autoFallbackStarted$ = this._autoFallbackStarted$.asObservable();

    // Computed signals
    readonly state = this._state.asReadonly();
    readonly isPending = computed(() => this._state().status === 'pending');
    readonly isAutoExecuting = computed(() => this._state().status === 'auto_executing');
    readonly isExecuting = computed(() => 
        this._state().status === 'executing' || this._state().status === 'auto_executing'
    );
    readonly pendingEvent = computed(() => this._state().pendingEvent);
    readonly failedAttempts = computed(() => this._state().failedAttempts);
    readonly currentProvider = computed(() => this._state().currentProvider);
    readonly isAutoFallback = computed(() => this._state().isAutoFallback);

    private readonly injectedConfig = inject(FALLBACK_CONFIG, { optional: true });

    constructor() {
        this.config = { ...DEFAULT_FALLBACK_CONFIG, ...this.injectedConfig };
    }

    /**
     * Obtiene la configuración actual.
     */
    getConfig(): Readonly<FallbackConfig> {
        return this.config;
    }

    /**
     * Reporta un fallo de pago y determina si hay alternativas disponibles.
     * 
     * @param failedProvider Provider que falló
     * @param error Error que ocurrió
     * @param originalRequest Request original
     * @param wasAutoFallback Si este intento fue un auto-fallback
     * @returns true si se emitió evento de fallback o se inició auto-fallback
     */
    reportFailure(
        failedProvider: PaymentProviderId,
        error: PaymentError,
        originalRequest: CreatePaymentRequest,
        wasAutoFallback: boolean = false
    ): boolean {
        if (!this.config.enabled) {
            return false;
        }

        // Verificar si el error es elegible para fallback
        if (!this.isEligibleForFallback(error)) {
            return false;
        }

        // Verificar si no excedimos el máximo de intentos
        const currentAttempts = this._state().failedAttempts.length;
        if (currentAttempts >= this.config.maxAttempts) {
            this.reset();
            return false;
        }

        // Obtener proveedores alternativos
        const alternatives = this.getAlternativeProviders(failedProvider, originalRequest);
        if (alternatives.length === 0) {
            return false;
        }

        // Registrar el intento fallido
        const failedAttempt: FailedAttempt = {
            provider: failedProvider,
            error,
            timestamp: Date.now(),
            wasAutoFallback,
        };

        this._state.update(state => ({
            ...state,
            failedAttempts: [...state.failedAttempts, failedAttempt],
        }));

        // Decidir si usar auto-fallback o manual
        if (this.config.mode === 'auto' && this.canAutoFallback()) {
            this.executeAutoFallback(alternatives[0], originalRequest);
            return true;
        }

        // Modo manual: emitir evento para la UI
        return this.emitFallbackAvailable(failedProvider, error, alternatives, originalRequest);
    }

    /**
     * Responde al evento de fallback (desde la UI).
     */
    respondToFallback(response: FallbackUserResponse): void {
        const currentEvent = this._state().pendingEvent;

        // Verificar que la respuesta corresponde al evento actual
        if (!currentEvent || currentEvent.eventId !== response.eventId) {
            console.warn('[FallbackOrchestrator] Response for unknown or expired event');
            return;
        }

        // Cancelar timeout
        this._cancel$.next();

        if (response.accepted && response.selectedProvider) {
            // Usuario aceptó el fallback
            this._state.update(state => ({
                ...state,
                status: 'executing',
                pendingEvent: null,
                currentProvider: response.selectedProvider!,
                isAutoFallback: false,
            }));

            // Emitir evento para que el componente ejecute el pago
            this._fallbackExecute$.next({
                request: currentEvent.originalRequest,
                provider: response.selectedProvider,
            });
        } else {
            // Usuario canceló
            this._state.update(state => ({
                ...state,
                status: 'cancelled',
                pendingEvent: null,
                isAutoFallback: false,
            }));
        }

        this._userResponse$.next(response);
    }

    /**
     * Notifica que el fallback se completó exitosamente.
     */
    notifySuccess(): void {
        this._state.update(state => ({
            ...state,
            status: 'completed',
            currentProvider: null,
            isAutoFallback: false,
        }));
    }

    /**
     * Notifica que el fallback también falló.
     * 
     * @param provider Provider que falló
     * @param error Error que ocurrió
     * @param originalRequest Request original (necesario para continuar fallback)
     */
    notifyFailure(
        provider: PaymentProviderId,
        error: PaymentError,
        originalRequest?: CreatePaymentRequest
    ): void {
        const wasAutoFallback = this._state().isAutoFallback;
        
        this._state.update(state => ({
            ...state,
            status: 'failed',
            currentProvider: null,
        }));

        // Si tenemos el request original, intentar reportar el nuevo fallo
        // para posiblemente activar otro fallback
        if (originalRequest) {
            this.reportFailure(provider, error, originalRequest, wasAutoFallback);
        }
    }

    /**
     * Resetea el estado del fallback.
     */
    reset(): void {
        this._cancel$.next();
        this._state.set(INITIAL_FALLBACK_STATE);
    }

    /**
     * Obtiene el estado actual como snapshot.
     */
    getSnapshot(): FallbackState {
        return this._state();
    }

    /**
     * Obtiene el número de auto-fallbacks ejecutados en el flujo actual.
     */
    getAutoFallbackCount(): number {
        return this._state().failedAttempts.filter(a => a.wasAutoFallback).length;
    }

    // ============================================================
    // MÉTODOS PRIVADOS
    // ============================================================

    private isEligibleForFallback(error: PaymentError): boolean {
        return this.config.triggerErrorCodes.includes(error.code);
    }

    private getAlternativeProviders(
        failedProvider: PaymentProviderId,
        request: CreatePaymentRequest
    ): PaymentProviderId[] {
        const allProviders = this.registry.getAvailableProviders();
        const failedProviderIds = this._state().failedAttempts.map(a => a.provider);
        
        // Filtrar providers que:
        // 1. No son el que falló
        // 2. No han fallado anteriormente en este flujo
        // 3. Soportan el método de pago del request
        return this.config.providerPriority
            .filter(provider => 
                provider !== failedProvider &&
                !failedProviderIds.includes(provider) &&
                allProviders.includes(provider)
            )
            .filter(provider => {
                try {
                    const factory = this.registry.get(provider);
                    return factory.supportsMethod(request.method.type);
                } catch {
                    return false;
                }
            });
    }

    /**
     * Verifica si se puede ejecutar un auto-fallback.
     */
    private canAutoFallback(): boolean {
        const autoAttempts = this._state().failedAttempts.filter(a => a.wasAutoFallback).length;
        return autoAttempts < this.config.maxAutoFallbacks;
    }

    /**
     * Ejecuta un fallback automático después de un delay.
     */
    private executeAutoFallback(
        provider: PaymentProviderId,
        request: CreatePaymentRequest
    ): void {
        const delay = this.config.autoFallbackDelay;

        // Actualizar estado a auto_executing
        this._state.update(state => ({
            ...state,
            status: 'auto_executing',
            currentProvider: provider,
            pendingEvent: null,
            isAutoFallback: true,
        }));

        // Notificar que se inició un auto-fallback (para feedback en UI)
        this._autoFallbackStarted$.next({ provider, delay });

        // Esperar el delay y luego ejecutar
        timer(delay)
            .pipe(
                takeUntil(this._cancel$),
                filter(() => this._state().status === 'auto_executing')
            )
            .subscribe(() => {
                // Emitir evento para que el componente ejecute el pago
                this._fallbackExecute$.next({ request, provider });
            });
    }

    /**
     * Emite evento de fallback disponible para modo manual.
     */
    private emitFallbackAvailable(
        failedProvider: PaymentProviderId,
        error: PaymentError,
        alternatives: PaymentProviderId[],
        originalRequest: CreatePaymentRequest
    ): boolean {
        // Emitir evento de fallback disponible
        const event: FallbackAvailableEvent = {
            failedProvider,
            error,
            alternativeProviders: alternatives,
            originalRequest,
            timestamp: Date.now(),
            eventId: this.generateEventId(),
        };

        this._state.update(state => ({
            ...state,
            status: 'pending',
            pendingEvent: event,
            isAutoFallback: false,
        }));

        this._fallbackAvailable$.next(event);

        // Configurar timeout
        this.setupTimeout(event.eventId);

        return true;
    }

    private setupTimeout(eventId: string): void {
        timer(this.config.userResponseTimeout)
            .pipe(
                takeUntil(this._cancel$),
                filter(() => this._state().pendingEvent?.eventId === eventId)
            )
            .subscribe(() => {
                // Timeout: tratar como cancelación
                this.respondToFallback({
                    eventId,
                    accepted: false,
                    timestamp: Date.now(),
                });
            });
    }

    private generateEventId(): string {
        return `fb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    }
}
