import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { PaymentRequestBuilderPort } from '@app/features/payments/domain/subdomains/payment/ports/payment-request/payment-request-builder.port';
import { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { Money } from '@payments/domain/common/primitives/money/money.vo';
import { UrlString } from '@payments/domain/common/primitives/url-string.vo';

/**
 * Base class for payment request builders.
 *
 * Lives in Application — not in Domain — because it contains validation
 * logic with invalidRequestError (i18n). Domain only exposes the port (interface).
 *
 * Infrastructure builders (Stripe, PayPal) extend this class.
 */
export abstract class BasePaymentRequestBuilder implements PaymentRequestBuilderPort {
  abstract forOrder(orderId: string): this;
  abstract withAmount(amount: number, currency: CurrencyCode): this;
  abstract withOptions(options: PaymentOptions): this;

  build(): CreatePaymentRequest {
    this.validateRequired();
    return this.buildUnsafe();
  }

  /** Each builder defines what is truly required */
  protected abstract validateRequired(): void;

  /** Build with guaranteed fields */
  protected abstract buildUnsafe(): CreatePaymentRequest;

  protected requireDefined<T>(field: string, value: T | null | undefined): asserts value is T {
    if (value === undefined || value === null) {
      throw invalidRequestError('errors.required_field_missing', { field });
    }
  }

  protected requireNonEmptyString(field: string, value: string | undefined | null) {
    if (value === undefined || value === null || value.trim().length === 0) {
      throw invalidRequestError('errors.required_field_missing', { field });
    }
  }

  protected requirePositiveAmount(field: string, value: number | undefined | null) {
    if (value === undefined || value === null || value <= 0) {
      throw invalidRequestError('errors.amount_invalid', { field, min: 1 }, { amount: value });
    }
  }

  /**
   * Validates an optional URL using the UrlString VO.
   * Returns the validated URL string or undefined if not provided.
   * @deprecated Use validateUrl instead for clearer semantics
   */
  protected validateOptionalUrl(
    field: 'returnUrl' | 'cancelUrl',
    value: string | undefined | null,
  ): string | undefined {
    if (value === undefined || value === null || value.trim().length === 0) return undefined;

    return this.validateUrl(field, value);
  }

  /**
   * Validates a URL using the UrlString VO.
   * @returns The validated URL string
   */
  protected validateUrl(
    field: 'returnUrl' | 'cancelUrl',
    value: string | undefined | null,
  ): string {
    if (value === undefined || value === null || value.trim().length === 0) {
      const fieldKey = field === 'returnUrl' ? 'return_url' : 'cancel_url';
      throw invalidRequestError(`errors.${fieldKey}_required`, { field });
    }

    const result = UrlString.from(value);
    if (!result.ok) {
      const v = result.violations[0];
      const fieldKey = field === 'returnUrl' ? 'return_url' : 'cancel_url';

      if (v.code === 'URL_STRING_EMPTY') {
        throw invalidRequestError(`errors.${fieldKey}_required`, { field });
      }

      throw invalidRequestError(`errors.${fieldKey}_invalid`, { field }, { [field]: value });
    }

    return result.value.value;
  }

  protected requireDefinedWithKey<T>(
    field: string,
    value: T | undefined | null,
    messageKey: string,
  ): asserts value is T {
    if (value === undefined || value === null) {
      throw invalidRequestError(messageKey, { field });
    }
  }

  protected requireNonEmptyStringWithKey(
    field: string,
    value: string | undefined | null,
    messageKey: string,
  ): void {
    if (value === undefined || value === null || value.trim().length === 0) {
      throw invalidRequestError(messageKey, { field });
    }
  }

  /**
   * Creates Money from amount+currency. Throws invalidRequestError on validation failure.
   */
  protected createMoneyOrThrow(amount: number, currency: CurrencyCode) {
    const result = Money.create(amount, currency);
    if (!result.ok) {
      const v = result.violations[0];
      if (v.code === 'MONEY_INVALID_CURRENCY') {
        throw invalidRequestError('errors.currency_required', { field: 'currency' });
      }
      throw invalidRequestError('errors.amount_invalid', { field: 'amount', min: 1 }, v.meta);
    }
    return result.value;
  }

  protected requirePositiveAmountWithKey(
    field: string,
    value: number | undefined | null,
    messageKey: string,
  ): void {
    if (value === undefined || value === null || value <= 0) {
      throw invalidRequestError(messageKey, { field, min: 1 }, { amount: value });
    }
  }

  protected requireEmailWithKey(
    field: string,
    value: string | undefined | null,
    missingKey: string,
    invalidKey: string,
  ): void {
    if (value === undefined || value === null || value.trim().length === 0) {
      throw invalidRequestError(missingKey, { field });
    }

    const email = value.trim();
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!isValid) {
      throw invalidRequestError(invalidKey, { field }, { [field]: value });
    }
  }

  /**
   * Validates orderId using the OrderId VO. Use when building CreatePaymentRequest.
   * @returns The validated OrderId VO
   */
  protected createOrderIdOrThrow(orderId: string | undefined | null, messageKey: string): OrderId {
    if (orderId === undefined || orderId === null) {
      throw invalidRequestError(messageKey, { field: 'orderId' });
    }

    const result = OrderId.from(orderId);
    if (!result.ok) {
      const v = result.violations[0];
      if (v.code === 'ORDER_ID_EMPTY') {
        throw invalidRequestError(messageKey, { field: 'orderId' });
      }
      if (v.code === 'ORDER_ID_TOO_LONG') {
        throw invalidRequestError('errors.order_id_too_long', {
          field: 'orderId',
          max: OrderId.MAX_LENGTH,
        });
      }
      throw invalidRequestError('errors.order_id_invalid', { field: 'orderId' }, { orderId });
    }

    return result.value;
  }

  /**
   * Validates intentId using the PaymentIntentId VO. Use when building Confirm/Cancel/GetStatus requests.
   * @returns The validated PaymentIntentId VO
   */
  protected createIntentIdOrThrow(
    intentId: string | undefined | null,
    messageKey: string,
  ): PaymentIntentId {
    if (intentId === undefined || intentId === null) {
      throw invalidRequestError(messageKey, { field: 'intentId' });
    }

    const result = PaymentIntentId.from(intentId);
    if (!result.ok) {
      const v = result.violations[0];
      if (v.code === 'PAYMENT_INTENT_ID_EMPTY') {
        throw invalidRequestError(messageKey, { field: 'intentId' });
      }
      if (v.code === 'PAYMENT_INTENT_ID_TOO_LONG') {
        throw invalidRequestError('errors.intent_id_too_long', {
          field: 'intentId',
          max: PaymentIntentId.MAX_LENGTH,
        });
      }
      throw invalidRequestError('errors.intent_id_invalid', { field: 'intentId' }, { intentId });
    }

    return result.value;
  }
}
