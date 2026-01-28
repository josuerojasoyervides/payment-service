import { inject, Injectable } from '@angular/core';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import type { Observable } from 'rxjs';

import { StripeCancelIntentGateway } from '../gateways/intent/cancel-intent.gateway';
import { StripeConfirmIntentGateway } from '../gateways/intent/confirm-intent.gateway';
import { StripeCreateIntentGateway } from '../gateways/intent/create-intent.gateway';
import { StripeGetIntentGateway } from '../gateways/intent/get-intent.gateway';

/**
 * Stripe gateway.
 *
 * Stripe-specific features:
 * - Uses PaymentIntents as main model
 * - Amounts in cents (100 = $1.00)
 * - Client secret for client-side authentication
 * - Native 3D Secure with next_action
 * - SPEI via Sources (Mexico)
 * - Idempotency keys for safe operations
 */
@Injectable()
export class StripeIntentFacade implements PaymentGatewayPort {
  readonly providerId = 'stripe' as const;

  private readonly createIntentOp = inject(StripeCreateIntentGateway);
  private readonly confirmIntentOp = inject(StripeConfirmIntentGateway);
  private readonly cancelIntentOp = inject(StripeCancelIntentGateway);
  private readonly getIntentOp = inject(StripeGetIntentGateway);

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
