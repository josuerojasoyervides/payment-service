import { effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { FallbackOrchestratorService } from '@payments/application/orchestration/services/fallback-orchestrator.service';
import { createPaymentsStoreActions } from '@payments/application/orchestration/store/actions/payment-store.actions';
import { createFallbackHandlers } from '@payments/application/orchestration/store/fallback/payment-store.fallback';
import type { PaymentsState } from '@payments/application/orchestration/store/payment-store.state';
import { initialPaymentsState } from '@payments/application/orchestration/store/payment-store.state';
import { setupPaymentFlowMachineBridge } from '@payments/application/orchestration/store/projection/payment-store.machine-bridge';
import { buildPaymentsSelectors } from '@payments/application/orchestration/store/projection/payment-store.selectors';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

export const PaymentsStore = signalStore(
  withState<PaymentsState>(initialPaymentsState),

  withComputed((state) => buildPaymentsSelectors(state)),

  withMethods((store) => {
    const fallbackOrchestrator = inject(FallbackOrchestratorService);
    const stateMachine = inject(PaymentFlowActorService);
    const actions = createPaymentsStoreActions(store, {
      stateMachine,
    });
    const fallbackHandlers = createFallbackHandlers(store, {
      fallbackOrchestrator,
      stateMachine,
    });

    // -----------------------------
    // Public API
    // -----------------------------

    return {
      ...actions,

      selectProvider(providerId: PaymentProviderId) {
        patchState(store, { selectedProvider: providerId });
      },

      ...fallbackHandlers,

      clearError() {
        patchState(store, { error: null, status: 'idle' });
      },

      clearHistory() {
        patchState(store, { history: [] });
      },

      reset() {
        fallbackOrchestrator.reset();
        patchState(store, { ...initialPaymentsState });
      },
    };
  }),

  withHooks((store) => ({
    onInit() {
      const fallbackOrchestrator = inject(FallbackOrchestratorService);
      const stateMachine = inject(PaymentFlowActorService);
      // 1) Bridge fallback orchestrator -> store
      effect(() => {
        patchState(store, { fallback: fallbackOrchestrator.state() });
      });

      // 2) Bridge xstate machine -> store (PR2)
      setupPaymentFlowMachineBridge(store, {
        stateMachine,
      });
    },
  })),
);
