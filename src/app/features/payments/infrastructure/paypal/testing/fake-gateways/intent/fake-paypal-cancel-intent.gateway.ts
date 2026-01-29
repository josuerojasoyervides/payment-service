import { Injectable } from '@angular/core';
import { FakeCancelIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/cancel-intent.gateway';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

@Injectable()
export class FakePaypalCancelIntentGateway extends FakeCancelIntentGateway {
  override readonly providerId: PaymentProviderId = 'paypal';
}
