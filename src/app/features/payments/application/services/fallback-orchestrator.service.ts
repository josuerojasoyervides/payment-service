import { computed, inject, Injectable, InjectionToken } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import {
  DEFAULT_FALLBACK_CONFIG,
  FallbackConfig,
} from '@payments/domain/models/fallback/fallback-config.types';
import {
  FallbackAvailableEvent,
  FallbackUserResponse,
} from '@payments/domain/models/fallback/fallback-event.types';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Subject } from 'rxjs';

import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import {
  hasDifferentEventId,
  isAutoExecutingGuard,
  isEventExpiredByAgeGuard,
  isEventExpiredGuard,
  isFallbackEnabledGuard,
  isOriginalRequestAvailableGuard,
  isPendingEventForResponseGuard,
  isPendingEventGuard,
  isResponseAcceptedGuard,
  isSameEventAndNotRespondedGuard,
  isSelectedProviderInAlternativesGuard,
} from './fallback/fallback-orchestrator.guards';
import {
  generateEventIdPolicy,
  getAlternativeProvidersPolicy,
  getAutoFallbackCountPolicy,
  hasReachedMaxAttemptsPolicy,
  isEligibleForFallbackPolicy,
  shouldAutoFallbackPolicy,
} from './fallback/fallback-orchestrator.policy';
import { createFallbackStateSignal } from './fallback/fallback-orchestrator.state';
import { scheduleAfterDelay, scheduleTTL } from './fallback/fallback-orchestrator.timers';
import {
  registerFailureTransition,
  resetTransition,
  setAutoExecutingTransition,
  setExecutingTransition,
  setFailedNoRequestTransition,
  setPendingManualTransition,
  setTerminalTransition,
} from './fallback/fallback-orchestrator.transitions';
import {
  AutoFallbackStartedPayload,
  FallbackExecutePayload,
  FinishStatus,
  ReportFailurePayload,
} from './fallback/fallback-orchestrator.types';

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
  private readonly logger = inject(LoggerService);

  private readonly _state = createFallbackStateSignal();

  private readonly _fallbackAvailable$ = new Subject<FallbackAvailableEvent>();
  private readonly _userResponse$ = new Subject<FallbackUserResponse>();
  private readonly _fallbackExecute$ = new Subject<FallbackExecutePayload>();
  private readonly _autoFallbackStarted$ = new Subject<AutoFallbackStartedPayload>();
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
    if (!isFallbackEnabledGuard(this.config)) return false;

    if (hasReachedMaxAttemptsPolicy(this.config, this._state())) {
      this.reset();
      return false;
    }

    // ✅ elegibilidad
    if (!isEligibleForFallbackPolicy(this.config, error)) return false;

    // ✅ registrar intento fallido (AHORA sí existe)
    registerFailureTransition(this._state, providerId, error, !!wasAutoFallback);

    // ✅ buscar alternativas
    const alternatives = getAlternativeProvidersPolicy(
      this.registry,
      this.config,
      this._state(),
      providerId,
      request,
    );

    // ✅ no hay alternativas => terminal
    if (alternatives.length === 0) {
      this.finish('failed');
      return false;
    }

    // ✅ decidir auto/manual
    if (shouldAutoFallbackPolicy(this.config, this._state())) {
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
    const currentEventId = currentEvent?.eventId ?? null;

    // 1) Evento inexistente / mismatch => ignorar
    if (!isPendingEventForResponseGuard(currentEvent, response)) {
      this.logger.warn(
        '[FallbackOrchestrator] Response for unknown or expired event',
        'fallback-orchestrator',
        {
          responseEventId: response.eventId,
          currentEventId,
          ttl: this.config.userResponseTimeout,
        },
      );
      return;
    }

    // 2) TTL excedido => cancelar
    if (isEventExpiredGuard(currentEvent, this.config)) {
      const now = Date.now();
      const eventAge = now - currentEvent.timestamp;

      this.logger.warn(
        '[FallbackOrchestrator] Response for expired event (TTL exceeded)',
        'fallback-orchestrator',
        {
          currentEventId: currentEvent.eventId,
          eventAge,
          ttl: this.config.userResponseTimeout,
        },
      );

      this.finish('cancelled');
      return;
    }

    // 3) Cancelar timers pendientes (timeout/auto)
    this._cancel$.next();

    // 4) Usuario declina => cancelar (evento válido)
    if (!isResponseAcceptedGuard(response)) {
      this.finish('cancelled');
      this._userResponse$.next(response);
      return;
    }

    // 5) Provider inválido => cancelar
    if (!isSelectedProviderInAlternativesGuard(currentEvent, response.selectedProvider)) {
      this.logger.warn(
        '[FallbackOrchestrator] Selected provider not in alternatives',
        'fallback-orchestrator',
        {
          selectedProvider: response.selectedProvider,
          alternativeProviders: currentEvent.alternativeProviders,
        },
      );

      this.finish('cancelled');
      this._userResponse$.next(response);
      return;
    }

    // 6) Ejecutar fallback manual aceptado
    setExecutingTransition(this._state, response.selectedProvider);

    this._fallbackExecute$.next({
      request: currentEvent.originalRequest,
      provider: response.selectedProvider,
    });

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
    if (!isOriginalRequestAvailableGuard(originalRequest)) {
      setFailedNoRequestTransition(this._state);
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
    resetTransition(this._state);
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
    return getAutoFallbackCountPolicy(this._state());
  }

  /**
   * Ejecuta un fallback automático después de un delay.
   */
  private executeAutoFallback(provider: PaymentProviderId, request: CreatePaymentRequest): void {
    const delay = this.config.autoFallbackDelay;

    // Actualizar estado a auto_executing
    setAutoExecutingTransition(this._state, provider);

    // Notificar que se inició un auto-fallback (para feedback en UI)
    this._autoFallbackStarted$.next({ provider, delay });

    // Esperar el delay y luego ejecutar
    scheduleAfterDelay(
      delay,
      this._cancel$,
      () => isAutoExecutingGuard(this._state(), provider),
      // Emitir evento para que el componente ejecute el pago
      () => {
        this._fallbackExecute$.next({ request, provider });
      },
    );
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
      eventId: generateEventIdPolicy(),
    };

    setPendingManualTransition(this._state, event);

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
    const ttlMs = this.config.userResponseTimeout;
    scheduleTTL(
      ttlMs,
      this._cancel$,
      () =>
        isSameEventAndNotRespondedGuard(
          eventId,
          this._state().pendingEvent?.eventId,
          this._state().status,
        ),
      () => {
        const currentEvent = this._state().pendingEvent;
        if (!isPendingEventGuard(currentEvent)) return;

        if (hasDifferentEventId(currentEvent.eventId, eventId)) return;

        const eventAge = Date.now() - currentEvent.timestamp;

        if (isEventExpiredByAgeGuard(eventAge, ttlMs)) {
          this.finish('cancelled');
        }
      },
    );
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

  private finish(status: FinishStatus) {
    this._cancel$.next();

    setTerminalTransition(this._state, status);

    // ✅ reset después (microtask) para que UI alcance a ver el estado final
    queueMicrotask(() => {
      this.reset();
    });
  }
}
