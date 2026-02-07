import { inject, Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { PaypalCancelIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/cancel-intent.gateway';
import { PaypalConfirmIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway';
import { PaypalGetIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/get-intent.gateway';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/create-intent.gateway';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import type { Observable } from 'rxjs';

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
  readonly providerId = PAYMENT_PROVIDER_IDS.paypal;

  // Gateway class names keep the "intent" suffix to align with PaymentGatewayPort.
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
