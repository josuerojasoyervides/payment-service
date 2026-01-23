import { PaymentGatewayPort } from '@payments/application/ports/payment-gateway.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { FakeCancelIntentGateway } from './intent/cancel-intent.gateway';
import { FakeConfirmIntentGateway } from './intent/confirm-intent.gateway';
import { FakeCreateIntentGateway } from './intent/create-intent.gateway';
import { FakeGetIntentGateway } from './intent/get-intent.gateway';

/**
 * Fake gateway for development and testing.
 *
 * Simulates realistic responses from Stripe and PayPal.
 * Behaves differently based on the assigned providerId.
 *
 * Features:
 * - Generates unique IDs for each request
 * - Simulates network delays (150-300ms)
 * - Responses in real format of each provider
 * - Simulates different flows (3DS, SPEI, PayPal redirect)
 * - Special tokens to force different behaviors
 */
export class FakePaymentGateway implements PaymentGatewayPort {
  readonly providerId: PaymentProviderId;

  constructor(
    private readonly _providerId: PaymentProviderId,
    private readonly createIntentOp: FakeCreateIntentGateway,
    private readonly confirmIntentOp: FakeConfirmIntentGateway,
    private readonly cancelIntentOp: FakeCancelIntentGateway,
    private readonly getIntentOp: FakeGetIntentGateway,
  ) {
    this.providerId = _providerId;
  }
  createIntent(req: CreatePaymentRequest): Observable<PaymentIntent> {
    return this.createIntentOp.execute(req);
  }

  confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent> {
    return this.confirmIntentOp.execute(req);
  }

  cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent> {
    return this.cancelIntentOp.execute(req);
  }

  getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent> {
    return this.getIntentOp.execute(req);
  }
}
