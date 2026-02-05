import { BasePaymentRequestBuilder } from '@app/features/payments/application/api/builders/base-payment-request.builder';
import type { Money } from '@app/features/payments/domain/common/primitives/money/money.vo';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

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
export class PaypalRedirectRequestBuilder extends BasePaymentRequestBuilder {
  private orderId?: string;
  private orderIdVo?: OrderId;
  private amount?: number;
  private currency?: CurrencyCode;
  private money?: Money;
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
    this.orderIdVo = this.createOrderIdOrThrow(this.orderId, PAYMENT_ERROR_KEYS.ORDER_ID_REQUIRED);
    this.requireDefinedWithKey('currency', this.currency, PAYMENT_ERROR_KEYS.CURRENCY_REQUIRED);
    this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency!);

    // returnUrl and cancelUrl are optional in builder - they can come from StrategyContext
    // But if provided, they must be valid URLs
    this.returnUrl = this.validateOptionalUrl('returnUrl', this.returnUrl);
    this.cancelUrl = this.validateOptionalUrl('cancelUrl', this.cancelUrl);
  }

  protected override buildUnsafe(): CreatePaymentRequest {
    /**
     * TODO: PaypalRedirectRequestBuilder - confirm this \"legit hack\".
     * This builder makes it explicit that PayPal does not have a card method,
     * it uses card only as a compatibility label.
     */
    return {
      orderId: this.orderIdVo!,
      money: this.money!,
      method: {
        type: 'card',
      },
      returnUrl: this.returnUrl,
      cancelUrl: this.cancelUrl,
    };
  }
}
