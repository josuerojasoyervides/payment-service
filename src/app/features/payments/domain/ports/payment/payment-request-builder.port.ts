import { AutoCompleteHint } from '@payments/domain/models/payment/autocomplete-hint.types';

import { CurrencyCode } from '../../models/payment/payment-intent.types';
import { CreatePaymentRequest } from '../../models/payment/payment-request.types';

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
}

/**
 * Base interface for payment request builders.
 *
 * This is the ABSTRACTION that the UI knows.
 * Infrastructure provides specific IMPLEMENTATIONS.
 *
 * The UI never imports from infrastructure, only uses this interface.
 */
export interface PaymentRequestBuilder {
  /**
   * Sets the order ID.
   */
  forOrder(orderId: string): this;

  /**
   * Sets amount and currency.
   */
  withAmount(amount: number, currency: CurrencyCode): this;

  /**
   * Sets payment method specific options.
   *
   * The UI passes all available options.
   * The builder uses what it needs and validates required ones.
   */
  withOptions(options: PaymentOptions): this;

  /**
   * Builds the final request.
   *
   * @throws Error if required fields are missing for this provider/method
   */
  build(): CreatePaymentRequest;
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
