import { I18nKeys } from '@core/i18n';
import type { CurrencyCode } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { PaymentOptions } from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';
import { PaymentRequestBuilder } from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';

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
export class StripeCardRequestBuilder extends PaymentRequestBuilder {
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

  withOptions(options: PaymentOptions): this {
    if (options.token !== undefined) this.token = options.token;
    if (options.saveForFuture !== undefined) this.saveForFuture = options.saveForFuture;
    return this;
  }

  protected override validateRequired(): void {
    this.requireNonEmptyStringWithKey('orderId', this.orderId, I18nKeys.errors.order_id_required);
    this.requirePositiveAmountWithKey('amount', this.amount, I18nKeys.errors.amount_invalid);
    this.requireDefinedWithKey('currency', this.currency, I18nKeys.errors.currency_required);
    this.requireNonEmptyStringWithKey('token', this.token, I18nKeys.errors.card_token_required);
  }

  protected override buildUnsafe(): CreatePaymentRequest {
    return {
      orderId: this.orderId!,
      amount: this.amount!,
      currency: this.currency!,
      method: {
        type: 'card',
        token: this.token!,
      },
      metadata: {
        saveForFuture: this.saveForFuture,
      },
    };
  }
}
