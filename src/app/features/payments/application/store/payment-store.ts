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
import { CancelPaymentUseCase } from '../use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '../use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '../use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '../use-cases/start-payment.use-case';
import { createPaymentsStoreActions } from './payment-store.actions';
import { setupFallbackExecuteListener } from './payment-store.fallback';
import { buildPaymentsSelectors } from './payment-store.selectors';
import { initialPaymentsState, PaymentsState } from './payment-store.state';

export const PaymentsStore = signalStore(
  withState<PaymentsState>(initialPaymentsState),

  withComputed((state) => buildPaymentsSelectors(state)),

  withMethods((store) => {
    const fallbackOrchestrator = inject(FallbackOrchestratorService);
    const startPaymentUseCase = inject(StartPaymentUseCase);
    const confirmPaymentUseCase = inject(ConfirmPaymentUseCase);
    const cancelPaymentUseCase = inject(CancelPaymentUseCase);
    const getPaymentStatusUseCase = inject(GetPaymentStatusUseCase);
    const stateMachine = inject(PaymentFlowActorService);

    const actions = createPaymentsStoreActions(store, {
      fallbackOrchestrator,
      startPaymentUseCase,
      confirmPaymentUseCase,
      cancelPaymentUseCase,
      getPaymentStatusUseCase,

      stateMachine,
    });

    setupFallbackExecuteListener(fallbackOrchestrator, actions.startPayment);

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
          actions.startPayment({ request: currentRequest, providerId });
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
          return;
        }

        fallbackOrchestrator.reset();
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

      effect(() => {
        patchState(store, { fallback: fallbackOrchestrator.state() });
      });
    },
  })),
);
