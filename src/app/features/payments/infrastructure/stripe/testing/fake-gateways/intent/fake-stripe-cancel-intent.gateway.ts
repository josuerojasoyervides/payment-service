import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { FakeCancelIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/cancel-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

@Injectable()
export class FakeStripeCancelIntentGateway extends FakeCancelIntentGateway {
  override readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.stripe;
}
