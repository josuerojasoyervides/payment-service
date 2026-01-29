import { inject, Injectable } from '@angular/core';
import type {
  ExternalStatusUpdatedPayload,
  RedirectReturnedPayload,
  WebhookReceivedPayload,
} from '@payments/application/adapters/events/payment-flow.events';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';

@Injectable()
export class ExternalEventAdapter {
  private readonly actor = inject(PaymentFlowActorService);

  redirectReturned(payload: RedirectReturnedPayload): void {
    this.actor.sendSystem({ type: 'REDIRECT_RETURNED', payload });
  }

  externalStatusUpdated(payload: ExternalStatusUpdatedPayload): void {
    this.actor.sendSystem({ type: 'EXTERNAL_STATUS_UPDATED', payload });
  }

  webhookReceived(payload: WebhookReceivedPayload): void {
    this.actor.sendSystem({ type: 'WEBHOOK_RECEIVED', payload });
  }
}
