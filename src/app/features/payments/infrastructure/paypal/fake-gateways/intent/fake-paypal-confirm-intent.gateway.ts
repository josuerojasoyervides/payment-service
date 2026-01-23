import { Injectable } from '@angular/core';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { FakeConfirmIntentGateway } from '@payments/infrastructure/fake/gateways/intent/confirm-intent.gateway';

@Injectable()
export class FakePaypalConfirmIntentGateway extends FakeConfirmIntentGateway {
  override readonly providerId: PaymentProviderId = 'paypal';
}
