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
 * Fallback orchestration service between providers.
 * 
 * This service detects payment provider failures and can:
 * - Manual mode: Notify UI for user decision
 * - Automatic mode: Execute fallback automatically without intervention
 * 
 * Manual Flow:
 * 1. Payment fails with provider A
 * 2. FallbackOrchestrator emits event with alternatives
 * 3. UI shows modal/notification to user
 * 4. User confirms or cancels
 * 5. If confirmed, component is notified to retry
 * 
 * Automatic Flow:
 * 1. Payment fails with provider A
 * 2. FallbackOrchestrator waits autoFallbackDelay
 * 3. Automatically executes with next provider
 * 4. If it also fails and there are more providers, repeats
 * 5. After maxAutoFallbacks, switches to manual mode
 * 
 * @example
 * ```typescript
 * { provide: FALLBACK_CONFIG, useValue: { mode: 'auto', autoFallbackDelay: 2000 } }
 * 
 * fallbackOrchestrator.fallbackExecute$.subscribe(({ request, provider }) => {
 *   this.store.startPayment({ request, providerId: provider });
 * });
 * ```
 */
@Injectable()
export class FallbackOrchestratorService {
    private readonly config: FallbackConfig;
    private readonly registry = inject(ProviderFactoryRegistry);

    private readonly _state = signal<FallbackState>(INITIAL_FALLBACK_STATE);

    private readonly _fallbackAvailable$ = new Subject<FallbackAvailableEvent>();
    private readonly _userResponse$ = new Subject<FallbackUserResponse>();
    private readonly _fallbackExecute$ = new Subject<{ request: CreatePaymentRequest; provider: PaymentProviderId }>();
    private readonly _autoFallbackStarted$ = new Subject<{ provider: PaymentProviderId; delay: number }>();
    private readonly _cancel$ = new Subject<void>();

    readonly fallbackAvailable$ = this._fallbackAvailable$.asObservable();
    readonly userResponse$ = this._userResponse$.asObservable();
    readonly fallbackExecute$ = this._fallbackExecute$.asObservable();

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
     * Gets current configuration.
     */
    getConfig(): Readonly<FallbackConfig> {
        return this.config;
    }

    /**
     * Reports a payment failure and determines if alternatives are available.
     * 
     * @param failedProvider Provider that failed
     * @param error Error that occurred
     * @param originalRequest Original request
     * @param wasAutoFallback Whether this attempt was an auto-fallback
     * @returns true if fallback event was emitted or auto-fallback was started
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

        if (!this.isEligibleForFallback(error)) {
            return false;
        }

        const currentAttempts = this._state().failedAttempts.length;
        if (currentAttempts >= this.config.maxAttempts) {
            this.reset();
            return false;
        }

        const alternatives = this.getAlternativeProviders(failedProvider, originalRequest);
        if (alternatives.length === 0) {
            return false;
        }

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

        if (this.config.mode === 'auto' && this.canAutoFallback()) {
            this.executeAutoFallback(alternatives[0], originalRequest);
            return true;
        }

        return this.emitFallbackAvailable(failedProvider, error, alternatives, originalRequest);
    }

    /**
     * Responds to fallback event (from UI).
     */
    respondToFallback(response: FallbackUserResponse): void {
        const currentEvent = this._state().pendingEvent;

        if (!currentEvent || currentEvent.eventId !== response.eventId) {
            console.warn('[FallbackOrchestrator] Response for unknown or expired event');
            return;
        }

        this._cancel$.next();

        if (response.accepted && response.selectedProvider) {
            this._state.update(state => ({
                ...state,
                status: 'executing',
                pendingEvent: null,
                currentProvider: response.selectedProvider!,
                isAutoFallback: false,
            }));

            this._fallbackExecute$.next({
                request: currentEvent.originalRequest,
                provider: response.selectedProvider,
            });
        } else {
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
     * Notifies that fallback completed successfully.
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
     * Notifies that fallback also failed.
     * 
     * @param provider Provider that failed
     * @param error Error that occurred
     * @param originalRequest Original request (needed to continue fallback)
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

        if (originalRequest) {
            this.reportFailure(provider, error, originalRequest, wasAutoFallback);
        }
    }

    /**
     * Resets fallback state.
     */
    reset(): void {
        this._cancel$.next();
        this._state.set(INITIAL_FALLBACK_STATE);
    }

    /**
     * Gets current state as snapshot.
     */
    getSnapshot(): FallbackState {
        return this._state();
    }

    /**
     * Gets number of auto-fallbacks executed in current flow.
     */
    getAutoFallbackCount(): number {
        return this._state().failedAttempts.filter(a => a.wasAutoFallback).length;
    }

    private isEligibleForFallback(error: PaymentError): boolean {
        return this.config.triggerErrorCodes.includes(error.code);
    }

    private getAlternativeProviders(
        failedProvider: PaymentProviderId,
        request: CreatePaymentRequest
    ): PaymentProviderId[] {
        const allProviders = this.registry.getAvailableProviders();
        const failedProviderIds = this._state().failedAttempts.map(a => a.provider);

        return this.config.providerPriority
            .filter(provider =>
                provider !== failedProvider &&
                !failedProviderIds.includes(provider) &&
                allProviders.includes(provider)
            )
            .filter(provider => {
                try {
                    const factory = this.registry.get(provider);
                    /* 
                        ! TODO FallbackOrchestrator filtra por método usando request.method.type
                        ! Si falla Stripe con SPEI:
                        ! request.method.type = 'spei'
                        ! entonces PayPal queda fuera ✅ (porque PayPal no soporta spei)
                        ! Pero si falla Stripe con CARD token:
                        ! request.method.type = 'card'
                        ! PayPal sí es alternativa ✅
                        ! Pero PayPal para “card” no es token-card, es redirect-card.
                        ! Eso significa que “fallback de card” hoy realmente está diciendo:
                        ! “fallback entre flows distintos”
                        ! ✅ ¿fallback permite cambiar de flow?
                        ! o solo cambiar de provider manteniendo el mismo flow?
                        ! Y si no lo defines, luego se siente como:
                        ! “por qué carajos me mandaste a PayPal si yo estaba pagando con tarjeta normal”
                    */
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
