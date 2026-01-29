import { Injectable } from '@angular/core';
import { FakeCreateIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/create-intent.gateway';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

@Injectable()
export class FakePaypalCreateIntentGateway extends FakeCreateIntentGateway {
  override readonly providerId: PaymentProviderId = 'paypal';
}
