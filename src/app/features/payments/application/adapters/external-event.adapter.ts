import { inject, Injectable } from '@angular/core';

import { PaymentFlowActorService } from '../orchestration/flow/payment-flow.actor.service';
import {
  ProviderUpdatePayload,
  StatusConfirmedPayload,
  ValidationFailedPayload,
  WebhookReceivedPayload,
} from './events/payment-flow.events';

@Injectable()
export class ExternalEventAdapter {
  private readonly actor = inject(PaymentFlowActorService);

  providerUpdate(payload: ProviderUpdatePayload, options?: { refresh?: boolean }): void {
    this.actor.sendSystem({ type: 'PROVIDER_UPDATE', payload });
    if (payload.referenceId && options?.refresh !== false) {
      this.actor.send({
        type: 'REFRESH',
        providerId: payload.providerId,
        intentId: payload.referenceId,
      });
    }
  }

  webhookReceived(payload: WebhookReceivedPayload): void {
    this.actor.sendSystem({ type: 'WEBHOOK_RECEIVED', payload });
  }

  validationFailed(payload: ValidationFailedPayload): void {
    this.actor.sendSystem({ type: 'VALIDATION_FAILED', payload });
  }

  statusConfirmed(payload: StatusConfirmedPayload): void {
    this.actor.sendSystem({ type: 'STATUS_CONFIRMED', payload });
  }
}
