import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { FakeGetIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/get-intent.gateway';

@Injectable()
export class FakePaypalGetIntentGateway extends FakeGetIntentGateway {
  override readonly providerId: PaymentProviderId = 'paypal';
}
