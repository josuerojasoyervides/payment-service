import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { FakeCreateIntentGateway } from '@payments/infrastructure/fake/gateways/intent/create-intent.gateway';

@Injectable()
export class FakeStripeCreateIntentGateway extends FakeCreateIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
