import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { FakeConfirmIntentGateway } from '@payments/infrastructure/fake/gateways/intent/confirm-intent.gateway';

@Injectable()
export class FakeStripeConfirmIntentGateway extends FakeConfirmIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
