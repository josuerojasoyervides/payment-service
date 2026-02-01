import type { AutoCompleteHint } from '@app/features/payments/domain/common/primitives/autocomplete-hint.types';
import type { FieldType } from '@app/features/payments/domain/common/primitives/fields/field.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
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
