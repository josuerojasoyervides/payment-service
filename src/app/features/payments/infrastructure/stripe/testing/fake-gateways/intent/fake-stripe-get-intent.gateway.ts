import { Injectable } from '@angular/core';
import { FakeGetIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/get-intent.gateway';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

@Injectable()
export class FakeStripeGetIntentGateway extends FakeGetIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
