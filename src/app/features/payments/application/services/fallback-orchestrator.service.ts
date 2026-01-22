import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import {
  DEFAULT_FALLBACK_CONFIG,
  FallbackConfig,
} from '@payments/domain/models/fallback/fallback-config.types';
import {
  FallbackAvailableEvent,
  FallbackUserResponse,
} from '@payments/domain/models/fallback/fallback-event.types';
import {
  FailedAttempt,
  FallbackState,
  INITIAL_FALLBACK_STATE,
} from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { filter, Subject, takeUntil, timer } from 'rxjs';

import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Token para inyectar configuración del fallback.
 */
export const FALLBACK_CONFIG = new InjectionToken<Partial<FallbackConfig>>('FALLBACK_CONFIG');

interface ReportFailurePayload {
  providerId: PaymentProviderId;
  error: PaymentError;
  request: CreatePaymentRequest;
  wasAutoFallback?: boolean;
}

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
  private readonly logger = inject(LoggerService);

  private readonly _state = signal<FallbackState>(INITIAL_FALLBACK_STATE);

  private readonly _fallbackAvailable$ = new Subject<FallbackAvailableEvent>();
  private readonly _userResponse$ = new Subject<FallbackUserResponse>();
  private readonly _fallbackExecute$ = new Subject<{
    request: CreatePaymentRequest;
    provider: PaymentProviderId;
  }>();
  private readonly _autoFallbackStarted$ = new Subject<{
    provider: PaymentProviderId;
    delay: number;
  }>();
  private readonly _cancel$ = new Subject<void>();

  readonly fallbackAvailable$ = this._fallbackAvailable$.asObservable();
  readonly userResponse$ = this._userResponse$.asObservable();
  readonly fallbackExecute$ = this._fallbackExecute$.asObservable();

  readonly autoFallbackStarted$ = this._autoFallbackStarted$.asObservable();

  // Computed signals
  readonly state = this._state.asReadonly();
  readonly isPending = computed(() => this._state().status === 'pending');
  readonly isAutoExecuting = computed(() => this._state().status === 'auto_executing');
  readonly isExecuting = computed(
    () => this._state().status === 'executing' || this._state().status === 'auto_executing',
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

  reportFailure(payload: ReportFailurePayload): boolean;
  reportFailure(
    providerId: PaymentProviderId,
    error: PaymentError,
    request: CreatePaymentRequest,
    wasAutoFallback?: boolean,
  ): boolean;

  reportFailure(
    arg1: ReportFailurePayload | PaymentProviderId,
    arg2?: PaymentError,
    arg3?: CreatePaymentRequest,
    arg4?: boolean,
  ): boolean {
    const payload: ReportFailurePayload =
      typeof arg1 === 'string'
        ? { providerId: arg1, error: arg2!, request: arg3!, wasAutoFallback: arg4 }
        : arg1;

    return this._reportFailure(payload);
  }

  private _reportFailure({
    providerId,
    error,
    request,
    wasAutoFallback,
  }: ReportFailurePayload): boolean {
    if (!this.config.enabled) return false;

    if (this._state().failedAttempts.length >= this.config.maxAttempts) {
      this.reset();
      return false;
    }

    // ✅ elegibilidad
    if (!this.isEligibleForFallback(error)) {
      return false;
    }

    // ✅ registrar intento fallido (AHORA sí existe)
    this.registerFailure(providerId, error, !!wasAutoFallback);

    // ✅ buscar alternativas
    const alternatives = this.getAlternativeProviders(providerId, request);

    // ✅ no hay alternativas => terminal
    if (alternatives.length === 0) {
      this.finish('failed');
      return false;
    }

    // ✅ decidir auto/manual
    if (this.shouldAutoFallback()) {
      this.startAutoFallback(alternatives[0], request);
    } else {
      this.emitManualFallbackEvent(providerId, error, alternatives, request);
    }

    return true;
  }

  /**
   * Responds to fallback event (from UI).
   *
   * Maneja eventos expirados de forma segura sin romper el flujo.
   */
  respondToFallback(response: FallbackUserResponse): void {
    const currentEvent = this._state().pendingEvent;

    // Verificar que el evento existe y coincide
    if (!currentEvent || currentEvent.eventId !== response.eventId) {
      // Evento desconocido o expirado - ignorar sin romper
      this.logger.warn(
        '[FallbackOrchestrator] Response for unknown or expired event',
        'fallback-orchestrator',
        {
          responseEventId: response.eventId,
          currentEventId: currentEvent?.eventId ?? null,
          ttl: this.config.userResponseTimeout,
        },
      );
      return;
    }

    // Verificar TTL: si el evento expiró, limpiarlo y ignorar
    const now = Date.now();
    const eventAge = now - currentEvent.timestamp;
    if (eventAge > this.config.userResponseTimeout) {
      this.logger.warn(
        '[FallbackOrchestrator] Response for expired event (TTL exceeded)',
        'fallback-orchestrator',
        {
          currentEventId: currentEvent.eventId,
          eventAge,
          ttl: this.config.userResponseTimeout,
        },
      );

      // Limpiar evento expirado
      this.finish('cancelled');

      return;
    }

    // Cancelar timers pendientes
    this._cancel$.next();

    if (response.accepted && response.selectedProvider) {
      // Validar que el provider seleccionado esté en las alternativas
      if (!currentEvent.alternativeProviders.includes(response.selectedProvider)) {
        this.logger.warn(
          '[FallbackOrchestrator] Selected provider not in alternatives',
          'fallback-orchestrator',
          {
            selectedProvider: response.selectedProvider,
            alternativeProviders: currentEvent.alternativeProviders,
          },
        );

        // Limpiar estado
        this.finish('cancelled');
        return;
      }

      this._state.update((state) => ({
        ...state,
        status: 'executing',
        pendingEvent: null,
        currentProvider: response.selectedProvider!,
        isAutoFallback: false,
      }));

      // Emitir evento con el originalRequest (sin modificar)
      this._fallbackExecute$.next({
        request: currentEvent.originalRequest,
        provider: response.selectedProvider,
      });
    } else {
      this.finish('cancelled');
    }

    this._userResponse$.next(response);
  }

  /**
   * Notifies that fallback completed successfully.
   */
  notifySuccess(): void {
    this.finish('completed');
  }

  /**
   * Notifies that fallback also failed.
   *
   * @param provider Provider that failed
   * @param error Error that occurred
   * @param originalRequest Original request (needed to continue fallback)
   */
  notifyFailure(
    providerId: PaymentProviderId,
    error: PaymentError,
    originalRequest?: CreatePaymentRequest,
    wasAutoFallback?: boolean,
  ) {
    if (!originalRequest) {
      this._state.update((s) => ({ ...s, status: 'failed', currentProvider: null }));
      return;
    }

    // 👇 inferencia automática si no lo pasan
    const inferredAuto = wasAutoFallback ?? this._state().isAutoFallback;

    this.reportFailure(providerId, error, originalRequest, inferredAuto);
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
    return this._state().failedAttempts.filter((a) => a.wasAutoFallback).length;
  }

  private isEligibleForFallback(error: PaymentError): boolean {
    return this.config.triggerErrorCodes.includes(error.code);
  }

  private getAlternativeProviders(
    failedProvider: PaymentProviderId,
    request: CreatePaymentRequest,
  ): PaymentProviderId[] {
    const allProviders = this.registry.getAvailableProviders();
    const failedProviderIds = this._state().failedAttempts.map((a) => a.provider);

    // ✅ Prioridad + “fallback” a providers reales del registry
    const priority = Array.from(new Set([...this.config.providerPriority, ...allProviders]));

    return priority
      .filter(
        (provider) =>
          provider !== failedProvider &&
          !failedProviderIds.includes(provider) &&
          allProviders.includes(provider),
      )
      .filter((provider) => {
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
    const autoAttempts = this._state().failedAttempts.filter((a) => a.wasAutoFallback).length;
    return autoAttempts < this.config.maxAutoFallbacks;
  }

  /**
   * Ejecuta un fallback automático después de un delay.
   */
  private executeAutoFallback(provider: PaymentProviderId, request: CreatePaymentRequest): void {
    const delay = this.config.autoFallbackDelay;

    // Actualizar estado a auto_executing
    this._state.update((state) => ({
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
        filter(() => this._state().status === 'auto_executing'),
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
    originalRequest: CreatePaymentRequest,
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

    this._state.update((state) => ({
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

  /**
   * Configura timeout para limpiar eventos expirados.
   *
   * Cuando expira el TTL, limpia el pending event para evitar
   * que la UI quede colgada esperando una respuesta.
   */
  private setupTimeout(eventId: string): void {
    timer(this.config.userResponseTimeout)
      .pipe(
        takeUntil(this._cancel$),
        filter(() => {
          const pendingEvent = this._state().pendingEvent;
          // Solo procesar si el evento sigue siendo el mismo y no ha sido respondido
          return pendingEvent?.eventId === eventId && this._state().status === 'pending';
        }),
      )
      .subscribe(() => {
        // Verificar que el evento sigue siendo válido antes de limpiar
        const currentEvent = this._state().pendingEvent;
        if (currentEvent?.eventId === eventId) {
          const now = Date.now();
          const eventAge = now - currentEvent.timestamp;

          // Si realmente expiró, limpiar el estado
          if (eventAge >= this.config.userResponseTimeout) {
            this.finish('cancelled');
          }
        }
      });
  }

  private generateEventId(): string {
    return `fb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private shouldAutoFallback(): boolean {
    return this.config.mode === 'auto' && this.canAutoFallback();
  }

  private startAutoFallback(provider: PaymentProviderId, request: CreatePaymentRequest): void {
    this.executeAutoFallback(provider, request);
  }

  private emitManualFallbackEvent(
    failedProvider: PaymentProviderId,
    error: PaymentError,
    alternatives: PaymentProviderId[],
    originalRequest: CreatePaymentRequest,
  ): void {
    this.emitFallbackAvailable(failedProvider, error, alternatives, originalRequest);
  }

  private registerFailure(
    providerId: PaymentProviderId,
    error: PaymentError,
    wasAutoFallback: boolean,
  ): void {
    const attempt: FailedAttempt = {
      provider: providerId,
      error,
      timestamp: Date.now(),
      wasAutoFallback,
    };

    this._state.update((s) => ({
      ...s,
      failedAttempts: [...s.failedAttempts, attempt],
      currentProvider: providerId,
    }));
  }

  private finish(status: 'completed' | 'cancelled' | 'failed') {
    this._cancel$.next();

    this._state.update((s) => ({
      ...s,
      status,
      pendingEvent: null,
      currentProvider: null,
      isAutoFallback: false,
    }));

    // ✅ reset después (microtask) para que UI alcance a ver el estado final
    queueMicrotask(() => {
      this.reset();
    });
  }
}
