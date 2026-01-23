import { Injectable } from '@angular/core';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { FakeCreateIntentGateway } from '@payments/infrastructure/fake/gateways/intent/create-intent.gateway';

@Injectable()
export class FakeStripeCreateIntentGateway extends FakeCreateIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
