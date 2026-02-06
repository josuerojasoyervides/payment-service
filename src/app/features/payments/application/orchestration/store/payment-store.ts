/**
 * Projected state surface consumable by UI via the port.
 *
 * Observes the XState machine and the fallback orchestrator; projects their state into
 * signals (status, intent, error, fallback, history). UI must not import this store
 * directly — use PAYMENT_STATE (PaymentStorePort) instead.
 */
import { computed, effect, inject } from '@angular/core';
import {
  updateState,
  withDevtools,
  withDisabledNameIndices,
  withGlitchTracking,
} from '@angular-architects/ngrx-toolkit';
import { FallbackOrchestratorService } from '@app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import type { PaymentsState } from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import {
  INITIAL_RESILIENCE_STATE,
  initialPaymentsState,
} from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import {
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { createPaymentsStoreActions } from '@payments/application/orchestration/store/actions/payment-store.actions';
import { createFallbackHandlers } from '@payments/application/orchestration/store/fallback/payment-store.fallback';
import { setupPaymentFlowMachineBridge } from '@payments/application/orchestration/store/projection/payment-store.machine-bridge';
import { buildPaymentsSelectors } from '@payments/application/orchestration/store/projection/payment-store.selectors';
import { sanitizeDebugEventForUi } from '@payments/application/orchestration/store/utils/debug-sanitize.rule';

export const PaymentsStore = signalStore(
  withState<PaymentsState>(initialPaymentsState),
  withDevtools('PaymentsStore', withGlitchTracking(), withDisabledNameIndices()),
  withComputed((state) => buildPaymentsSelectors(state)),
  withProps(() => ({
    _fallbackOrchestrator: inject(FallbackOrchestratorService),
    _stateMachine: inject(PaymentFlowActorService),
    _providerRegistry: inject(ProviderFactoryRegistry),
  })),
  withComputed((store) => {
    const machine = (store as { _stateMachine: PaymentFlowActorService })._stateMachine;
    const snapshot = machine.snapshot;
    const resumeProviderId = computed(() => {
      const snap = snapshot();
      if (!snap.hasTag('idle')) return null;
      return (snap.context.providerId as PaymentProviderId) ?? null;
    });
    const resumeIntentId = computed(() => {
      const snap = snapshot();
      if (!snap.hasTag('idle')) return null;
      const ctx = snap.context;
      const id = ctx.intent?.id ?? ctx.intentId;
      return id?.value ?? null;
    });
    const debugStateNode = computed(() => {
      const snap = snapshot();
      const value = snap.value;
      return typeof value === 'string' ? value : JSON.stringify(value);
    });
    const debugTags = computed(() => {
      const snap = snapshot();
      const tags = (snap as { tags?: Set<string> }).tags;
      return Array.from(tags ?? [], (t) => String(t));
    });
    const debugLastEventType = computed(() => machine.lastSentEvent()?.type ?? null);
    const debugLastEventPayload = computed(() => sanitizeDebugEventForUi(machine.lastSentEvent()));
    const canRetryClientConfirm = computed(() => {
      const snap = snapshot();
      const retry = snap.context.clientConfirmRetry;
      const action = snap.context.intent?.nextAction;
      return (
        snap.hasTag('requiresAction') &&
        action?.kind === 'client_confirm' &&
        retry.count >= 1 &&
        retry.lastErrorCode === 'timeout'
      );
    });
    return {
      resumeProviderId,
      resumeIntentId,
      canResume: computed(() => !!(resumeProviderId() && resumeIntentId())),
      debugStateNode,
      debugTags,
      debugLastEventType,
      debugLastEventPayload,
      canRetryClientConfirm,
    };
  }),
  withMethods(({ _fallbackOrchestrator, _stateMachine, ...store }) => {
    return {
      ...createPaymentsStoreActions(store, {
        stateMachine: _stateMachine,
      }),

      selectProvider(providerId: PaymentProviderId) {
        updateState(store, 'selectProvider', { selectedProvider: providerId });
      },

      ...createFallbackHandlers(store, {
        fallbackOrchestrator: _fallbackOrchestrator,
        stateMachine: _stateMachine,
      }),

      clearError() {
        updateState(store, 'clearError', { error: null, status: 'idle' });
      },

      setError(error: PaymentError) {
        updateState(store, 'setError', { error, status: 'error' });
      },

      clearHistory() {
        updateState(store, 'clearHistory', { history: [] });
      },

      reset() {
        _fallbackOrchestrator.reset();
        _stateMachine.send({ type: 'RESET' });
        updateState(store, 'reset', { ...initialPaymentsState });
      },
    };
  }),

  withHooks({
    onInit({ _fallbackOrchestrator, _stateMachine, _providerRegistry, ...store }) {
      // 1) Bridge fallback orchestrator -> store
      effect(() => {
        updateState(store, 'fallback bridge', { fallback: _fallbackOrchestrator.state() });
      });

      // 2) Bridge xstate machine -> store (PR2)
      setupPaymentFlowMachineBridge(store, {
        stateMachine: _stateMachine,
      });

      // 3) Resilience state projection (PR4b)
      effect(() => {
        const snapshot = _stateMachine.snapshot();
        const fallback = _fallbackOrchestrator.state();

        const base = { ...INITIAL_RESILIENCE_STATE };

        if (snapshot.hasTag('circuitOpen')) {
          const openedAt = snapshot.context.resilience.circuitOpenedAt ?? Date.now();
          const cooldownMs = snapshot.context.resilience.circuitCooldownMs ?? 0;
          base.status = 'circuit_open';
          base.cooldownUntilMs = openedAt + cooldownMs;
        } else if (snapshot.hasTag('circuitHalfOpen')) {
          base.status = 'circuit_half_open';
        } else if (snapshot.hasTag('rateLimited')) {
          const openedAt = snapshot.context.resilience.rateLimitOpenedAt ?? Date.now();
          const cooldownMs = snapshot.context.resilience.rateLimitCooldownMs ?? 0;
          base.status = 'rate_limited';
          base.cooldownUntilMs = openedAt + cooldownMs;
        } else if (snapshot.hasTag('pendingManualReview')) {
          base.status = 'pending_manual_review';
          const providerId =
            snapshot.context.providerId ?? snapshot.context.intent?.provider ?? null;
          const intentId =
            snapshot.context.intent?.id?.value ?? snapshot.context.intentId?.value ?? null;
          if (providerId && intentId) {
            const factory = _providerRegistry.get(providerId);
            const dashboardUrl = factory.getDashboardUrl?.(intentId) ?? '';
            base.manualReview = {
              intentId,
              providerId,
              dashboardUrl,
            };
          }
        } else if (snapshot.hasTag('allProvidersUnavailable')) {
          base.status = 'all_providers_unavailable';
        } else if (fallback.pendingEvent) {
          base.status = 'fallback_confirming';
          base.fallbackConfirmation = {
            eligibleProviders: fallback.pendingEvent.alternativeProviders,
            failureReason: fallback.pendingEvent.error.code,
            timeoutMs: _fallbackOrchestrator.getConfig().userResponseTimeout,
          };
        }

        updateState(store, 'resilience bridge', { resilience: base });
      });
    },
  }),
);
