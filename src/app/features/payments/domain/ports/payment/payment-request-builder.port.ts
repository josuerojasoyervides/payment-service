import type { AutoCompleteHint } from '@payments/domain/models/payment/autocomplete-hint.types';
import { invalidRequestError } from '@payments/domain/models/payment/payment-error.factory';
import type {
  CurrencyCode,
  PaymentMethodType,
} from '@payments/domain/models/payment/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

/**
 * Generic options for the builder.
 *
 * Contains ALL possible fields that any provider might need.
 * Each specific builder uses what it needs and validates required ones.
 */
export interface PaymentOptions {
  token?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  saveForFuture?: boolean;
  description?: string;
  createdAt?: Date;
  paymentMethodTypes?: PaymentMethodType[];
}

/**
 * Field types supported in the form.
 */
export type FieldType = 'text' | 'email' | 'hidden' | 'url';

/**
 * Field requirements for a specific provider/method.
 *
 * The UI queries this BEFORE rendering the form
 * to know which fields to show.
 */
export interface FieldRequirement {
  name: keyof PaymentOptions;
  labelKey: string;
  placeholderKey?: string;
  descriptionKey?: string;
  instructionsKey?: string;

  required: boolean;
  type: 'text' | 'email' | 'hidden';

  autoComplete?: AutoCompleteHint;
  defaultValue?: string;
}

export interface FieldRequirements {
  descriptionKey?: string;
  instructionsKey?: string;
  fields: FieldRequirement[];
}

/**
 * Base interface for payment request builders.
 *
 * This is the ABSTRACTION that the UI knows.
 * Infrastructure provides specific IMPLEMENTATIONS.
 *
 * The UI never imports from infrastructure, only uses this interface.
 */
export abstract class PaymentRequestBuilder {
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

  protected validateOptionalUrl(
    field: 'returnUrl' | 'cancelUrl',
    value: string | undefined | null,
  ) {
    // If it's missing, it's NOT an error
    if (value === undefined || value === null || value.trim().length === 0) return;

    try {
      new URL(value);
    } catch {
      const fieldKey = field === 'returnUrl' ? 'return_url' : 'cancel_url';
      throw invalidRequestError(`errors.${fieldKey}_invalid`, { field }, { [field]: value });
    }
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
}
