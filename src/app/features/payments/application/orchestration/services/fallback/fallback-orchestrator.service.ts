import { computed, inject, Injectable, InjectionToken } from '@angular/core';
import { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { createFallbackStateSignal } from '@app/features/payments/application/orchestration/services/fallback/helpers/fallback-orchestrator.state';
import type {
  AutoFallbackStartedPayload,
  FallbackExecutePayload,
  FinishStatus,
  ReportFailurePayload,
} from '@app/features/payments/application/orchestration/services/fallback/helpers/fallback-orchestrator.types';
import type { FallbackConfig } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-config.model';
import type { FallbackState } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.model';
import type { FallbackAvailableEvent } from '@app/features/payments/domain/subdomains/fallback/messages/fallback-available.event';
import type { FallbackUserResponse } from '@app/features/payments/domain/subdomains/fallback/messages/fallback-user-response.command';
import { isEligibleForFallbackPolicy } from '@app/features/payments/domain/subdomains/fallback/policies/eligible-for-fallback.policy';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { LoggerService } from '@core/logging/logger.service';
import { DEFAULT_FALLBACK_CONFIG } from '@payments/application/orchestration/services/fallback/fallback-config.constant';
import {
  hasDifferentEventId,
  isAutoExecutingGuard,
  isEventExpiredByAgeGuard,
  isEventExpiredGuard,
  isFallbackEnabledGuard,
  isPendingEventForResponseGuard,
  isPendingEventGuard,
  isResponseAcceptedGuard,
  isSameEventAndNotRespondedGuard,
  isSelectedProviderInAlternativesGuard,
} from '@payments/application/orchestration/services/fallback/policies/fallback-orchestrator.guards';
import {
  generateEventIdPolicy,
  getAlternativeProvidersPolicy,
  getAutoFallbackCountPolicy,
  hasReachedMaxAttemptsPolicy,
  shouldAutoFallbackPolicy,
} from '@payments/application/orchestration/services/fallback/policies/fallback-orchestrator.policy';
import {
  scheduleAfterDelay,
  scheduleTTL,
} from '@payments/application/orchestration/services/fallback/runtime/fallback-orchestrator.timers';
import {
  registerFailureTransition,
  resetTransition,
  setAutoExecutingTransition,
  setExecutingTransition,
  setFailedNoRequestTransition,
  setPendingManualTransition,
  setTerminalTransition,
} from '@payments/application/orchestration/services/fallback/runtime/fallback-orchestrator.transitions';
import { Subject } from 'rxjs';

/**
 * Token for injecting fallback configuration.
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

  private flowId: string | null = null;

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

    // ✅ eligibility
    if (!isEligibleForFallbackPolicy(this.config, error)) return false;

    // ✅ record failed attempt (now exists)
    registerFailureTransition(this._state, providerId, error, !!wasAutoFallback);

    if (hasReachedMaxAttemptsPolicy(this.config, this._state())) {
      this.finish('failed');
      return false;
    }

    // ✅ find alternatives
    const alternatives = getAlternativeProvidersPolicy(
      this.registry,
      this.config,
      this._state(),
      providerId,
      request,
    );

    // ✅ no alternatives => terminal
    if (alternatives.length === 0) {
      this.finish('failed');
      return false;
    }

    const flowId = this.getOrCreateFlowId();

    // ✅ decide auto/manual
    if (shouldAutoFallbackPolicy(this.config, this._state())) {
      this.startAutoFallback(alternatives[0], request, providerId, flowId);
    } else {
      this.emitManualFallbackEvent(providerId, error, alternatives, request, flowId);
    }

    return true;
  }

  /**
   * Responds to fallback event (from UI).
   *
   * Handle expired events safely without breaking the flow.
   */
  respondToFallback(response: FallbackUserResponse): void {
    const currentEvent = this._state().pendingEvent;
    const currentEventId = currentEvent?.eventId ?? null;

    // 1) Missing event / mismatch => ignore
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

    // 2) TTL exceeded => cancel
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

    // 3) Cancel pending timers (timeout/auto)
    this._cancel$.next();

    // 4) User declines => cancel (valid event)
    if (!isResponseAcceptedGuard(response)) {
      this.finish('cancelled');
      this._userResponse$.next(response);
      return;
    }

    // 5) Invalid provider => cancel
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

    // 6) Execute accepted manual fallback
    setExecutingTransition(this._state, response.selectedProvider);

    this._fallbackExecute$.next({
      request: currentEvent.originalRequest,
      provider: response.selectedProvider,

      fromProvider: currentEvent.failedProvider,
      eventId: currentEvent.eventId,
      wasAutoFallback: false,
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
    const req = originalRequest ?? this._state().originalRequest;
    if (!req) {
      setFailedNoRequestTransition(this._state);
      return;
    }

    // 👇 auto inference if not provided
    const inferredAuto = wasAutoFallback ?? this._state().isAutoFallback;

    this.reportFailure(providerId, error, req, inferredAuto);
  }

  /**
   * Resets fallback state.
   */
  reset(): void {
    this._cancel$.next();
    resetTransition(this._state);

    this.clearFlowId();
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
   * Execute automatic fallback after a delay.
   */
  private executeAutoFallback(
    provider: PaymentProviderId,
    request: CreatePaymentRequest,
    fromProvider: PaymentProviderId,
    flowId: string,
  ): void {
    const delay = this.config.autoFallbackDelay;

    // auto_executing state
    setAutoExecutingTransition(this._state, provider, request);

    // ✅ autoFallbackStarted now has real correlation
    this._autoFallbackStarted$.next({
      provider,
      delay,
      fromProvider,
      eventId: flowId,
      wasAutoFallback: true,
    });

    scheduleAfterDelay(
      delay,
      this._cancel$,
      () => isAutoExecutingGuard(this._state(), provider),
      () => {
        // ✅ fallbackExecute completo
        this._fallbackExecute$.next({
          request,
          provider,
          fromProvider,
          eventId: flowId,
          wasAutoFallback: true,
        });
      },
    );
  }

  /**
   * Emits fallback available event for manual mode.
   */
  private emitFallbackAvailable(
    failedProvider: PaymentProviderId,
    error: PaymentError,
    alternatives: PaymentProviderId[],
    originalRequest: CreatePaymentRequest,
    flowId: string,
  ): boolean {
    const event: FallbackAvailableEvent = {
      failedProvider,
      error,
      alternativeProviders: alternatives,
      originalRequest,
      timestamp: Date.now(),
      eventId: flowId, // ✅ no regeneres
    };

    setPendingManualTransition(this._state, event);
    this._fallbackAvailable$.next(event);

    this.setupTimeout(event.eventId);
    return true;
  }

  /**
   * Schedules timeout to clear expired events.
   *
   * When TTL expires, clear the pending event to avoid leaving the UI waiting.
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

  private startAutoFallback(
    provider: PaymentProviderId,
    request: CreatePaymentRequest,
    fromProvider: PaymentProviderId,
    flowId: string,
  ): void {
    this.executeAutoFallback(provider, request, fromProvider, flowId);
  }

  private emitManualFallbackEvent(
    failedProvider: PaymentProviderId,
    error: PaymentError,
    alternatives: PaymentProviderId[],
    originalRequest: CreatePaymentRequest,
    flowId: string,
  ): void {
    this.emitFallbackAvailable(failedProvider, error, alternatives, originalRequest, flowId);
  }

  private finish(status: FinishStatus) {
    this._cancel$.next();

    setTerminalTransition(this._state, status);

    queueMicrotask(() => {
      this.reset();
    });
  }

  acknowledge(): void {
    this.reset();
  }

  private getOrCreateFlowId(): string {
    if (!this.flowId) this.flowId = generateEventIdPolicy();
    return this.flowId;
  }

  private clearFlowId(): void {
    this.flowId = null;
  }
}
