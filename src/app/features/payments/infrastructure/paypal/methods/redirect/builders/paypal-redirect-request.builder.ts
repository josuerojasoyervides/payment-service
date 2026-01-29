import { I18nKeys } from '@core/i18n';
import type { CurrencyCode } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.types';
import type { PaymentOptions } from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';
import { PaymentRequestBuilder } from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';

/**
 * Builder for payments via PayPal (redirect flow).
 *
 * PayPal ALWAYS uses redirect flow, even for cards.
 * The user is redirected to PayPal to authorize the payment.
 *
 * This builder knows that PayPal needs:
 * - returnUrl (REQUIRED) - URL to redirect after payment
 * - cancelUrl (OPTIONAL) - URL if user cancels (default: returnUrl)
 *
 * Does NOT need:
 * - token (PayPal handles this internally)
 * - customerEmail (PayPal gets it from user)
 */
export class PaypalRedirectRequestBuilder extends PaymentRequestBuilder {
  private orderId?: string;
  private amount?: number;
  private currency?: CurrencyCode;
  private returnUrl?: string;
  private cancelUrl?: string;

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
    if (options.cancelUrl !== undefined) this.cancelUrl = options.cancelUrl;

    if (options.returnUrl !== undefined) {
      this.returnUrl = options.returnUrl;
      if (!options.cancelUrl) {
        this.cancelUrl = options.returnUrl;
      }
    }
    return this;
  }

  protected override validateRequired(): void {
    this.requireNonEmptyStringWithKey('orderId', this.orderId, I18nKeys.errors.order_id_required);
    this.requirePositiveAmountWithKey('amount', this.amount, I18nKeys.errors.amount_invalid);
    this.requireDefinedWithKey('currency', this.currency, I18nKeys.errors.currency_required);
    this.validateOptionalUrl('returnUrl', this.returnUrl);
    this.validateOptionalUrl('cancelUrl', this.cancelUrl);
  }

  protected override buildUnsafe(): CreatePaymentRequest {
    /**
     * TODO: PaypalRedirectRequestBuilder - confirm this \"legit hack\".
     * This builder makes it explicit that PayPal does not have a card method,
     * it uses card only as a compatibility label.
     */
    return {
      orderId: this.orderId!,
      amount: this.amount!,
      currency: this.currency!,
      method: {
        type: 'card',
      },
      returnUrl: this.returnUrl!,
      cancelUrl: this.cancelUrl!,
    };
  }
}
