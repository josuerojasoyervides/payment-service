import { Injectable } from '@angular/core';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { FakeCancelIntentGateway } from '@payments/infrastructure/fake/gateways/intent/cancel-intent.gateway';

@Injectable()
export class FakeStripeCancelIntentGateway extends FakeCancelIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
