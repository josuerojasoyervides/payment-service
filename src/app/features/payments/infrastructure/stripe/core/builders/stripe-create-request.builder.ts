import { BasePaymentRequestBuilder } from '@app/features/payments/application/api/builders/base-payment-request.builder';
import type { Money } from '@app/features/payments/domain/common/primitives/money/money.vo';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { StripeCreateIntentRequest } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import type { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';

export function buildStripeCreateRequest(req: CreatePaymentRequest): StripeCreateIntentRequest {
  const isCard = req.method.type === 'card';

  return {
    amount: Math.round(req.money.amount * 100),
    currency: req.money.currency.toLowerCase(),

    payment_method_types: [isCard ? 'card' : 'spei'],

    ...(isCard ? { payment_method: req.method.token } : {}),

    metadata: {
      order_id: req.orderId.value,
    },
  };
}

export class StripeCreateRequestBuilder extends BasePaymentRequestBuilder {
  private orderId?: string;
  private orderIdVo?: OrderId;
  private amount?: number;
  private currency?: CurrencyCode;
  private money?: Money;

  private token?: string;
  private paymentMethodTypes?: PaymentMethodType[];

  // Optional fields you may want to pass into CreatePaymentRequest as metadata:
  private saveForFuture?: boolean;
  private description?: string;
  private createdAt?: Date;

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
    this.token = options.token;
    this.paymentMethodTypes = options.paymentMethodTypes;

    this.saveForFuture = options.saveForFuture;
    this.description = options.description;
    this.createdAt = options.createdAt;

    return this;
  }

  protected override validateRequired(): void {
    // Required basics
    this.orderIdVo = this.createOrderIdOrThrow(this.orderId, 'errors.required_field_missing');
    this.money = this.createMoneyOrThrow(this.amount ?? 0, this.currency ?? 'MXN');

    // Selected method
    this.requireDefined('paymentMethodTypes', this.paymentMethodTypes);

    if (this.paymentMethodTypes.length !== 1) {
      throw invalidRequestError('errors.payment_method_ambiguous', {
        field: 'paymentMethodTypes',
      });
    }

    const selected = this.paymentMethodTypes[0];

    if (selected === 'card') {
      this.requireNonEmptyString('method.token', this.token);
    }

    if (selected !== 'card' && selected !== 'spei') {
      throw invalidRequestError('errors.payment_method_not_supported', {
        field: 'paymentMethodTypes',
        method: selected,
      });
    }
  }

  protected override buildUnsafe(): CreatePaymentRequest {
    const selected = this.paymentMethodTypes![0];

    return {
      orderId: this.orderIdVo!,
      money: this.money!,
      method: {
        type: selected,
        token: selected === 'card' ? this.token! : undefined,
      },
      metadata: {
        saveForFuture: this.saveForFuture,
        description: this.description,
        createdAt: this.createdAt?.toISOString(),
      },
    };
  }
}
