import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { FakeCreateIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/create-intent.gateway';

@Injectable()
export class FakePaypalCreateIntentGateway extends FakeCreateIntentGateway {
  override readonly providerId: PaymentProviderId = 'paypal';
}
