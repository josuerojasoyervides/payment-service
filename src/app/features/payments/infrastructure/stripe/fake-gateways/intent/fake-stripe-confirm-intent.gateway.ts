import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

import { FakeConfirmIntentGateway } from '../../../fake/gateways/intent/confirm-intent.gateway';

@Injectable()
export class FakeStripeConfirmIntentGateway extends FakeConfirmIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
