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

import { PaypalCancelIntentGateway } from '../gateways/intent/cancel-intent.gateway';
import { PaypalConfirmIntentGateway } from '../gateways/intent/confirm-intent.gateway';
import { PaypalCreateIntentGateway } from '../gateways/intent/create-intent.gateway';
import { PaypalGetIntentGateway } from '../gateways/intent/get-intent.gateway';

/**
 * PayPal gateway (Orders API v2).
 *
 * Key differences vs Stripe:
 * - PayPal uses "Orders" instead of "PaymentIntents"
 * - Amounts as strings with 2 decimals ("100.00")
 * - Flow: Create Order → Approve (redirect) → Capture
 * - HATEOAS links for navigation
 * - No client_secret, uses session cookies
 */
@Injectable()
export class PaypalIntentFacade implements PaymentGatewayPort {
  readonly providerId = 'paypal' as const;

  private readonly createIntentOp = inject(PaypalCreateIntentGateway);
  private readonly confirmIntentOp = inject(PaypalConfirmIntentGateway);
  private readonly cancelIntentOp = inject(PaypalCancelIntentGateway);
  private readonly getIntentOp = inject(PaypalGetIntentGateway);

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
