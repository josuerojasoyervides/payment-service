import { effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { PaymentFlowActorService } from '../state-machine/payment-flow.actor.service';
import { createFallbackHandlers } from './fallback/payment-store.fallback';
import { createPaymentsStoreActions } from './payment-store.actions';
import { setupPaymentFlowMachineBridge } from './projection/payment-store.machine-bridge';
import { buildPaymentsSelectors } from './projection/payment-store.selectors';
import { initialPaymentsState, PaymentsState } from './projection/payment-store.state';

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
