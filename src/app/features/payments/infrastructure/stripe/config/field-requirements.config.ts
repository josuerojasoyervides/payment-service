import type { FieldRequirements } from '@app/features/payments/application/api/contracts/checkout-field-requirements.types';

export const STRIPE_CARD_FIELD_REQUIREMENTS: FieldRequirements = {
  descriptionKey: 'ui.card_payment_description',
  instructionsKey: 'ui.enter_card_data',
  fields: [
    {
      name: 'token',
      labelKey: 'ui.card_token',
      required: true,
      type: 'hidden',
      defaultValue: 'tok_visa1234567890abcdef',
    },
    {
      name: 'saveForFuture',
      labelKey: 'ui.save_card_future',
      required: false,
      type: 'text',
      defaultValue: 'false',
    },
  ],
};

export const STRIPE_SPEI_FIELD_REQUIREMENTS: FieldRequirements = {
  descriptionKey: 'ui.spei_bank_transfer',
  instructionsKey: 'ui.spei_email_instructions',
  fields: [
    {
      name: 'customerEmail',
      labelKey: 'ui.email_label',
      placeholderKey: 'ui.email_placeholder',
      required: true,
      type: 'email',
    },
  ],
};
