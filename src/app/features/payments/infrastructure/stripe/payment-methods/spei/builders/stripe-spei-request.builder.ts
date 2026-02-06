import { BasePaymentRequestBuilder } from '@app/features/payments/application/api/builders/base-payment-request.builder';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';
import type { Money } from '@payments/domain/common/primitives/money/money.vo';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';

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
  private orderIdVo?: OrderId;
  private amount?: number;
  private currency?: CurrencyCode;
  private customerEmail?: string;
  private money?: Money;
  private idempotencyKey?: string;

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

  withIdempotencyKey(idempotencyKey: string): this {
    this.idempotencyKey = idempotencyKey;
    return this;
  }

  protected override validateRequired(): void {
    this.orderIdVo = this.createOrderIdOrThrow(this.orderId, PAYMENT_ERROR_KEYS.ORDER_ID_REQUIRED);
    this.requireDefinedWithKey('currency', this.currency, PAYMENT_ERROR_KEYS.CURRENCY_REQUIRED);
    this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency!);

    this.requireEmailWithKey(
      'customerEmail',
      this.customerEmail,
      PAYMENT_ERROR_KEYS.CUSTOMER_EMAIL_REQUIRED,
      PAYMENT_ERROR_KEYS.CUSTOMER_EMAIL_INVALID,
    );
    this.requireNonEmptyStringWithKey(
      'idempotencyKey',
      this.idempotencyKey,
      PAYMENT_ERROR_KEYS.INVALID_REQUEST,
    );
  }

  protected override buildUnsafe(): CreatePaymentRequest {
    return {
      orderId: this.orderIdVo!,
      money: this.money!,
      method: {
        type: 'spei',
      },
      customerEmail: this.customerEmail!,
      idempotencyKey: this.idempotencyKey!,
    };
  }
}
