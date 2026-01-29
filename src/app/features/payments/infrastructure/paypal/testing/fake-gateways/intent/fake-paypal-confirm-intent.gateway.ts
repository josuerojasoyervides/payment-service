import { Injectable } from '@angular/core';
import { FakeConfirmIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/confirm-intent.gateway';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

@Injectable()
export class FakePaypalConfirmIntentGateway extends FakeConfirmIntentGateway {
  override readonly providerId: PaymentProviderId = 'paypal';
}
