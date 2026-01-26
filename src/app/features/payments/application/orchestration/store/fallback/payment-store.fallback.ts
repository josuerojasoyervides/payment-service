import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

import { PaymentFlowActorService } from '../../flow/payment-flow.actor.service';
import { FallbackOrchestratorService } from '../../services/fallback-orchestrator.service';
import type { PaymentsStoreContext } from '../payment-store.types';

interface PaymentsStoreFallbackDeps {
  fallbackOrchestrator: FallbackOrchestratorService;
  stateMachine: PaymentFlowActorService;
}

export function createFallbackHandlers(
  store: PaymentsStoreContext,
  deps: PaymentsStoreFallbackDeps,
) {
  const { fallbackOrchestrator, stateMachine } = deps;

  return {
    executeFallback(providerId: PaymentProviderId) {
      const pendingEvent = store.fallback().pendingEvent;

      if (!pendingEvent) {
        const currentRequest = store.currentRequest();
        if (!currentRequest) return;
        const failedProviderId = store.selectedProvider() ?? store.intent()?.provider ?? null;
        stateMachine.sendSystem({
          type: 'FALLBACK_EXECUTE',
          providerId,
          request: currentRequest,
          ...(failedProviderId && { failedProviderId }),
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
        stateMachine.sendSystem({ type: 'FALLBACK_ABORT' });
        return;
      }

      fallbackOrchestrator.reset();
      stateMachine.sendSystem({ type: 'FALLBACK_ABORT' });
    },
  };
}
