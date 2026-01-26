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
import { createPaymentsStoreActions } from './payment-store.actions';
import { setupPaymentFlowMachineBridge } from './payment-store.machine-bridge';
import { buildPaymentsSelectors } from './payment-store.selectors';
import { initialPaymentsState, PaymentsState } from './payment-store.state';

export const PaymentsStore = signalStore(
  withState<PaymentsState>(initialPaymentsState),

  withComputed((state) => buildPaymentsSelectors(state)),

  withMethods((store) => {
    const fallbackOrchestrator = inject(FallbackOrchestratorService);
    const stateMachine = inject(PaymentFlowActorService);
    const actions = createPaymentsStoreActions(store, {
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

      executeFallback(providerId: PaymentProviderId) {
        const pendingEvent = store.fallback().pendingEvent;

        if (!pendingEvent) {
          const currentRequest = store.currentRequest();
          if (!currentRequest) return;
          stateMachine.send({
            type: 'FALLBACK_EXECUTE',
            providerId,
            request: currentRequest,
          });
          return;
        }

        if (!pendingEvent.alternativeProviders.includes(providerId)) return;

        fallbackOrchestrator.respondToFallback({
          eventId: pendingEvent.eventId,
          accepted: true,
          selectedProvider: providerId,
          timestamp: Date.now(),
        });
      },

      cancelFallback() {
        const pendingEvent = store.fallback().pendingEvent;

        if (pendingEvent) {
          fallbackOrchestrator.respondToFallback({
            eventId: pendingEvent.eventId,
            accepted: false,
            timestamp: Date.now(),
          });
          stateMachine.send({ type: 'FALLBACK_ABORT' });
          return;
        }

        fallbackOrchestrator.reset();
        stateMachine.send({ type: 'FALLBACK_ABORT' });
      },

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
