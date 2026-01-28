import { inject, Injectable } from '@angular/core';

import { PaymentFlowActorService } from '../orchestration/flow/payment-flow.actor.service';
import type {
  ExternalStatusUpdatedPayload,
  RedirectReturnedPayload,
  WebhookReceivedPayload,
} from './events/payment-flow.events';

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
