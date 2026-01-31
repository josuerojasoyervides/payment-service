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
import { initialPaymentsState } from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import {
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { createPaymentsStoreActions } from '@payments/application/orchestration/store/actions/payment-store.actions';
import { createFallbackHandlers } from '@payments/application/orchestration/store/fallback/payment-store.fallback';
import { setupPaymentFlowMachineBridge } from '@payments/application/orchestration/store/projection/payment-store.machine-bridge';
import { buildPaymentsSelectors } from '@payments/application/orchestration/store/projection/payment-store.selectors';
import { sanitizeDebugEventForUi } from '@payments/application/orchestration/store/utils/debug-sanitize.rule';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

export const PaymentsStore = signalStore(
  withState<PaymentsState>(initialPaymentsState),
  withDevtools('PaymentsStore', withGlitchTracking(), withDisabledNameIndices()),
  withComputed((state) => buildPaymentsSelectors(state)),
  withProps(() => ({
    _fallbackOrchestrator: inject(FallbackOrchestratorService),
    _stateMachine: inject(PaymentFlowActorService),
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
      return ctx.intent?.id ?? ctx.intentId ?? null;
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
    return {
      resumeProviderId,
      resumeIntentId,
      canResume: computed(() => !!(resumeProviderId() && resumeIntentId())),
      debugStateNode,
      debugTags,
      debugLastEventType,
      debugLastEventPayload,
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
    onInit({ _fallbackOrchestrator, _stateMachine, ...store }) {
      // 1) Bridge fallback orchestrator -> store
      effect(() => {
        updateState(store, 'fallback bridge', { fallback: _fallbackOrchestrator.state() });
      });

      // 2) Bridge xstate machine -> store (PR2)
      setupPaymentFlowMachineBridge(store, {
        stateMachine: _stateMachine,
      });
    },
  }),
);
