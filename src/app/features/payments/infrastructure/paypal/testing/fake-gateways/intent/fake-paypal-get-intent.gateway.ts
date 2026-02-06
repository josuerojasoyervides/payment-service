import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { FakeGetIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/get-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

@Injectable()
export class FakePaypalGetIntentGateway extends FakeGetIntentGateway {
  override readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.paypal;
}
