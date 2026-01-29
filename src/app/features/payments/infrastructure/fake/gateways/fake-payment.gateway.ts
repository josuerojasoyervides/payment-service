import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/subdomains/payment/contracts/payment-request.types';
import type { FakeCancelIntentGateway } from '@payments/infrastructure/fake/gateways/intent/cancel-intent.gateway';
import type { FakeConfirmIntentGateway } from '@payments/infrastructure/fake/gateways/intent/confirm-intent.gateway';
import type { FakeCreateIntentGateway } from '@payments/infrastructure/fake/gateways/intent/create-intent.gateway';
import type { FakeGetIntentGateway } from '@payments/infrastructure/fake/gateways/intent/get-intent.gateway';
import type { Observable } from 'rxjs';

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
