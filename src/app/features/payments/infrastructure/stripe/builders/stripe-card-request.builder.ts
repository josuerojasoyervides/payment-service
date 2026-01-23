import { invalidRequestError } from '@payments/domain/models/payment/payment-error.faactory';
import { CurrencyCode } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import {
  PaymentOptions,
  PaymentRequestBuilder,
} from '../../../domain/ports/payment/payment-request-builder.port';

/**
 * Builder for card payments via Stripe.
 *
 * This builder knows that Stripe card needs:
 * - token (REQUIRED) - Stripe Elements token
 * - saveForFuture (OPTIONAL) - Whether to save the method for future use
 *
 * Does NOT need:
 * - returnUrl (Stripe handles 3DS internally)
 * - cancelUrl
 * - customerEmail (optional, Stripe gets it from token)
 */
export class StripeCardRequestBuilder implements PaymentRequestBuilder {
  private orderId?: string;
  private amount?: number;
  private currency?: CurrencyCode;
  private token?: string;
  private saveForFuture?: boolean;

  forOrder(orderId: string): this {
    this.orderId = orderId;
    return this;
  }

  withAmount(amount: number, currency: CurrencyCode): this {
    this.amount = amount;
    this.currency = currency;
    return this;
  }

  /**
   * Receives generic options and extracts what Stripe Card needs.
   */
  withOptions(options: PaymentOptions): this {
    if (options.token !== undefined) {
      this.token = options.token;
    }
    if (options.saveForFuture !== undefined) {
      this.saveForFuture = options.saveForFuture;
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
        type: 'card',
        token: this.token,
      },
      metadata: {
        saveForFuture: this.saveForFuture,
      },
    };
  }

  /**
   * Stripe Card-specific validation.
   */
  private validate(): void {
    if (!this.orderId) {
      throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
    }
    if (!this.amount || this.amount <= 0) {
      throw invalidRequestError(
        'errors.amount_invalid',
        { field: 'amount', min: 1 },
        { amount: this.amount },
      );
    }
    if (!this.currency) {
      throw invalidRequestError('errors.currency_required', { field: 'currency' });
    }

    if (!this.token) {
      throw invalidRequestError('errors.card_token_required', { field: 'method.token' });
    }
  }
}
