import type {
  PaymentIntent,
  PaymentProviderId,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { FakeCancelIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/cancel-intent.gateway';
import type { FakeConfirmIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/confirm-intent.gateway';
import type { FakeCreateIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/create-intent.gateway';
import type { FakeGetIntentGateway } from '@app/features/payments/infrastructure/fake/workflows/intent/gateways/get-intent.gateway';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/subdomains/payment/contracts/payment-request.command';
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
