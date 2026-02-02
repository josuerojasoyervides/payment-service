import { BasePaymentRequestBuilder } from '@app/features/payments/application/api/builders/base-payment-request.builder';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { I18nKeys } from '@core/i18n/i18n.keys';
import type { Money } from '@payments/domain/common/primitives/money/money.vo';

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
export class StripeSpeiRequestBuilder extends BasePaymentRequestBuilder {
  private orderId?: string;
  private amount?: number;
  private currency?: CurrencyCode;
  private customerEmail?: string;
  private money?: Money;

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
    this.orderId = this.validateOrderId(this.orderId, I18nKeys.errors.order_id_required);
    this.requireDefinedWithKey('currency', this.currency, I18nKeys.errors.currency_required);
    this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency!);

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
      money: this.money!,
      method: {
        type: 'spei',
      },
      customerEmail: this.customerEmail!,
    };
  }
}
