import { inject, Injectable } from '@angular/core';
import { PaymentGatewayPort } from '@payments/application/ports/payment-gateway.port';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { StripeCancelIntentGateway } from './cancel-intent.gateway';
import { StripeConfirmIntentGateway } from './confirm-intent.gateway';
import { StripeCreateIntentGateway } from './create-intent.gateway';
import { StripeGetIntentGateway } from './get-intent.gateway';

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
export class IntentFacade implements PaymentGatewayPort {
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
