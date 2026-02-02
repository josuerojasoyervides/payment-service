import { BasePaymentRequestBuilder } from '@app/features/payments/application/api/builders/base-payment-request.builder';
import type { Money } from '@app/features/payments/domain/common/primitives/money/money.vo';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { I18nKeys } from '@core/i18n';
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
import type { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';

export class StripeCardRequestBuilder extends BasePaymentRequestBuilder {
  private orderId?: string;
  private orderIdVo?: OrderId;
  private amount?: number;
  private currency?: CurrencyCode;
  private money?: Money;
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
    this.orderIdVo = this.createOrderIdOrThrow(this.orderId, I18nKeys.errors.order_id_required);
    this.requireDefinedWithKey('currency', this.currency, I18nKeys.errors.currency_required);
    this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency!);
    this.requireNonEmptyStringWithKey('token', this.token, I18nKeys.errors.card_token_required);
  }

  protected override buildUnsafe(): CreatePaymentRequest {
    return {
      orderId: this.orderIdVo!,
      money: this.money!,
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
