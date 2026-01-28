import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { FakeCancelIntentGateway } from '@payments/infrastructure/fake/gateways/intent/cancel-intent.gateway';

@Injectable()
export class FakePaypalCancelIntentGateway extends FakeCancelIntentGateway {
  override readonly providerId: PaymentProviderId = 'paypal';
}
