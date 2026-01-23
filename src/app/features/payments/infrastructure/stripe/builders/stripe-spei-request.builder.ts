import { invalidRequestError } from '@payments/domain/models/payment/payment-error.factory';
import { CurrencyCode } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import {
  PaymentOptions,
  PaymentRequestBuilder,
} from '../../../domain/ports/payment/payment-request-builder.port';

/**
 * Builder for SPEI payments via Stripe.
 *
 * This builder knows that Stripe SPEI needs:
 * - customerEmail (REQUIRED) - To send payment instructions
 *
 * Does NOT need:
 * - token (SPEI doesn't use tokenization)
 * - returnUrl (No redirect)
 * - saveForFuture (Not applicable to SPEI)
 */
export class StripeSpeiRequestBuilder implements PaymentRequestBuilder {
  private orderId?: string;
  private amount?: number;
  private currency?: CurrencyCode;
  private customerEmail?: string;

  forOrder(orderId: string): this {
    this.orderId = orderId;
    return this;
  }

  withAmount(amount: number, currency: CurrencyCode): this {
    this.amount = amount;
    this.currency = currency;
    return this;
  }

  withOptions(options: PaymentOptions): this {
    if (options.customerEmail !== undefined) {
      this.customerEmail = options.customerEmail;
    }
    return this;
  }

  build(): CreatePaymentRequest {
    this.validate();

    return {
      orderId: this.orderId!,
      amount: this.amount!,
      currency: this.currency!,
      method: {
        type: 'spei',
      },
      customerEmail: this.customerEmail,
    };
  }

  private validate(): void {
    if (!this.orderId) {
      throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
    }

    // Nota: usamos Number.isFinite para cubrir NaN también
    if (!Number.isFinite(this.amount) || (this.amount ?? 0) <= 0) {
      throw invalidRequestError(
        'errors.amount_invalid',
        { field: 'amount', min: 1 },
        { amount: this.amount },
      );
    }

    if (!this.currency) {
      throw invalidRequestError('errors.currency_required', { field: 'currency' });
    }

    if (!this.customerEmail) {
      throw invalidRequestError('errors.customer_email_required', { field: 'customerEmail' });
    }

    // validación ultra simple (tu test solo pide includes('@'))
    if (!this.customerEmail.includes('@')) {
      throw invalidRequestError(
        'errors.customer_email_invalid',
        { field: 'customerEmail' },
        { customerEmail: this.customerEmail },
      );
    }
  }
}
