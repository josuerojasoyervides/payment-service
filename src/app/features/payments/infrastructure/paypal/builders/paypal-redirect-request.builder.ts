import { invalidRequestError } from '@payments/domain/models/payment/payment-error.factory';
import { CurrencyCode } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import {
  PaymentOptions,
  PaymentRequestBuilder,
} from '../../../domain/ports/payment/payment-request-builder.port';

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
export class PaypalRedirectRequestBuilder implements PaymentRequestBuilder {
  private orderId?: string;
  private amount?: number;
  private currency?: CurrencyCode;
  private returnUrl?: string;
  private cancelUrl?: string;

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
    if (options.returnUrl !== undefined) {
      this.returnUrl = options.returnUrl;
    }
    if (options.cancelUrl !== undefined) {
      this.cancelUrl = options.cancelUrl;
    }
    return this;
  }

  build(): CreatePaymentRequest {
    this.validate();
    /**
     * ! TODO: PaypalRedirectRequestBuilder: confirma el “hack legítimo”
     * ! Este builder deja clarísimo que PayPal no tiene card como método,
     * ! sino que está usando card como etiqueta de compatibilidad:
     */
    return {
      orderId: this.orderId!,
      amount: this.amount!,
      currency: this.currency!,
      method: {
        type: 'card',
      },
      returnUrl: this.returnUrl,
      cancelUrl: this.cancelUrl ?? this.returnUrl,
    };
  }

  private validate(): void {
    if (!this.orderId) {
      throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
    }
    if (!this.amount || this.amount <= 0) {
      throw invalidRequestError('errors.amount_invalid', { field: 'amount' });
    }
    if (!this.currency) {
      throw invalidRequestError('errors.currency_required', { field: 'currency' });
    }
    // returnUrl es opcional en el builder - puede venir de StrategyContext
    // Solo validar formato si está presente
    if (this.returnUrl) {
      try {
        new URL(this.returnUrl);
      } catch {
        throw invalidRequestError('errors.return_url_invalid', { field: 'returnUrl' });
      }
    }
    if (this.cancelUrl) {
      try {
        new URL(this.cancelUrl);
      } catch {
        throw invalidRequestError('errors.cancel_url_invalid', { field: 'cancelUrl' });
      }
    }
  }
}
