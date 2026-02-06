import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { FakeCreateIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/create-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

@Injectable()
export class FakePaypalCreateIntentGateway extends FakeCreateIntentGateway {
  override readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.paypal;
}
