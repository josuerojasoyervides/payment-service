import { inject, Injectable, InjectionToken, signal, computed } from '@angular/core';
import { Subject, Observable, timer, takeUntil, filter, take } from 'rxjs';
import { PaymentProviderId } from '../../domain/models/payment.types';
import { PaymentError } from '../../domain/models/payment.errors';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';
import {
    FallbackAvailableEvent,
    FallbackUserResponse,
    FallbackState,
    FallbackConfig,
    DEFAULT_FALLBACK_CONFIG,
    INITIAL_FALLBACK_STATE,
} from '../../domain/models/fallback.types';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Token para inyectar configuración del fallback.
 */
export const FALLBACK_CONFIG = new InjectionToken<Partial<FallbackConfig>>('FALLBACK_CONFIG');

/**
 * Servicio de orquestación de fallback entre proveedores.
 * 
 * Este servicio detecta fallos en proveedores de pago y notifica
 * a la UI para que el usuario decida si intentar con otro proveedor.
 * 
 * Flujo:
 * 1. Pago falla con provider A
 * 2. FallbackOrchestrator emite evento con alternativas
 * 3. UI muestra modal/notificación al usuario
 * 4. Usuario confirma o cancela
 * 5. Si confirma, se notifica al componente para reintentar
 * 
 * @example
 * ```typescript
 * // En el componente
 * fallbackOrchestrator.fallbackAvailable$.subscribe(event => {
 *   this.showFallbackModal(event);
 * });
 * 
 * // Cuando el usuario responde
 * fallbackOrchestrator.respondToFallback({
 *   eventId: event.eventId,
 *   accepted: true,
 *   selectedProvider: 'paypal'
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
    private readonly _cancel$ = new Subject<void>();

    // Observables públicos
    readonly fallbackAvailable$ = this._fallbackAvailable$.asObservable();
    readonly userResponse$ = this._userResponse$.asObservable();
    readonly fallbackExecute$ = this._fallbackExecute$.asObservable();

    // Computed signals
    readonly state = this._state.asReadonly();
    readonly isPending = computed(() => this._state().status === 'pending');
    readonly pendingEvent = computed(() => this._state().pendingEvent);
    readonly failedAttempts = computed(() => this._state().failedAttempts);

    private readonly injectedConfig = inject(FALLBACK_CONFIG, { optional: true });

    constructor() {
        this.config = { ...DEFAULT_FALLBACK_CONFIG, ...this.injectedConfig };
    }

    /**
     * Reporta un fallo de pago y determina si hay alternativas disponibles.
     * 
     * @param failedProvider Provider que falló
     * @param error Error que ocurrió
     * @param originalRequest Request original
     * @returns true si se emitió evento de fallback, false si no hay alternativas
     */
    reportFailure(
        failedProvider: PaymentProviderId,
        error: PaymentError,
        originalRequest: CreatePaymentRequest
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
        this._state.update(state => ({
            ...state,
            status: 'pending',
            failedAttempts: [
                ...state.failedAttempts,
                { provider: failedProvider, error, timestamp: Date.now() }
            ],
        }));

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
            pendingEvent: event,
        }));

        this._fallbackAvailable$.next(event);

        // Configurar timeout
        this.setupTimeout(event.eventId);

        return true;
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
        }));
    }

    /**
     * Notifica que el fallback también falló.
     */
    notifyFailure(provider: PaymentProviderId, error: PaymentError): void {
        // El fallo del fallback se maneja como un nuevo fallo
        // que podría activar otro fallback si hay más alternativas
        this._state.update(state => ({
            ...state,
            status: 'failed',
            currentProvider: null,
        }));
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
