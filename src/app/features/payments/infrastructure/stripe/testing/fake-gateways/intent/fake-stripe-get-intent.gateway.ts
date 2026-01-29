import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { FakeGetIntentGateway } from '@payments/infrastructure/fake/gateways/intent/get-intent.gateway';

@Injectable()
export class FakeStripeGetIntentGateway extends FakeGetIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
