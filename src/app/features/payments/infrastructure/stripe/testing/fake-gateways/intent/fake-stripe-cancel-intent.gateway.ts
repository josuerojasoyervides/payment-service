import { Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { FakeCancelIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/cancel-intent.gateway';

@Injectable()
export class FakeStripeCancelIntentGateway extends FakeCancelIntentGateway {
  override readonly providerId: PaymentProviderId = 'stripe';
}
