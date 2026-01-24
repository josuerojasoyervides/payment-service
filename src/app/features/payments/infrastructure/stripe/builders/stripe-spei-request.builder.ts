import { I18nKeys } from '@core/i18n/i18n.keys';
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
export class StripeSpeiRequestBuilder extends PaymentRequestBuilder {
  private orderId?: string;
  private amount?: number;
  private currency?: CurrencyCode;
  private customerEmail?: string;

  constructor() {
    super();
  }

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
    if (options.customerEmail !== undefined) this.customerEmail = options.customerEmail;
    return this;
  }

  protected override validateRequired(): void {
    this.requireNonEmptyStringWithKey('orderId', this.orderId, I18nKeys.errors.order_id_required);
    this.requirePositiveAmountWithKey('amount', this.amount, I18nKeys.errors.amount_invalid);
    this.requireDefinedWithKey('currency', this.currency, I18nKeys.errors.currency_required);

    this.requireEmailWithKey(
      'customerEmail',
      this.customerEmail,
      I18nKeys.errors.customer_email_required,
      I18nKeys.errors.customer_email_invalid,
    );
  }

  protected override buildUnsafe(): CreatePaymentRequest {
    return {
      orderId: this.orderId!,
      amount: this.amount!,
      currency: this.currency!,
      method: {
        type: 'spei',
      },
      customerEmail: this.customerEmail!,
    };
  }
}
