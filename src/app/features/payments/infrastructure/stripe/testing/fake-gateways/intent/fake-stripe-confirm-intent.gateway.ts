import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { FakeConfirmIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/confirm-intent.gateway';

@Injectable()
export class FakeStripeConfirmIntentGateway extends FakeConfirmIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
