import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';

/**
 * HTML input types supported in checkout forms.
 * UI schema contract — not domain logic.
 */
export const FIELD_TYPES = ['text', 'email', 'hidden', 'url'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Autocomplete hints for form fields (HTML autocomplete attribute values).
 * UI schema contract — not domain logic.
 */
export const AUTOCOMPLETE_HINTS = [
  'email',
  'name',
  'given-name',
  'family-name',
  'tel',
  'street-address',
  'postal-code',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'off',
  'current-url',
] as const;

export type AutoCompleteHint = (typeof AUTOCOMPLETE_HINTS)[number];

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
  type: FieldType;

  autoComplete?: AutoCompleteHint;
  defaultValue?: string;
}

export interface FieldRequirements {
  descriptionKey?: string;
  instructionsKey?: string;
  fields: FieldRequirement[];
}
