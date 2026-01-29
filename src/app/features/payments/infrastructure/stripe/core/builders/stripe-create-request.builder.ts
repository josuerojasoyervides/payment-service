import type { StripeCreateIntentRequest } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { invalidRequestError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type {
  CurrencyCode,
  PaymentMethodType,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { PaymentOptions } from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';
import { PaymentRequestBuilder } from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';

export function buildStripeCreateRequest(req: CreatePaymentRequest): StripeCreateIntentRequest {
  const isCard = req.method.type === 'card';

  return {
    amount: Math.round(req.amount * 100),
    currency: req.currency.toLowerCase(),

    payment_method_types: [isCard ? 'card' : 'spei'],

    ...(isCard ? { payment_method: req.method.token } : {}),

    metadata: {
      order_id: req.orderId,
    },
  };
}

export class StripeCreateRequestBuilder extends PaymentRequestBuilder {
  private orderId?: string;
  private amount?: number;
  private currency?: CurrencyCode;

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
    this.requireNonEmptyString('orderId', this.orderId);
    this.requirePositiveAmount('amount', this.amount);
    this.requireDefined('currency', this.currency);

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
      orderId: this.orderId!,
      amount: this.amount!,
      currency: this.currency!,
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
