/**
 * Error message keys emitted by the payment domain.
 *
 * These are opaque strings that the UI layer translates via i18n.
 * Convention: keys must match entries in en.ts/es.ts translation files.
 *
 * Domain defines the vocabulary of errors; it does NOT implement i18n.
 */
export const PAYMENT_ERROR_KEYS = {
  // Card errors
  CARD_TOKEN_REQUIRED: 'errors.card_token_required',
  CARD_TOKEN_INVALID_FORMAT: 'errors.card_token_invalid_format',

  // Amount errors (shared across methods)
  MIN_AMOUNT: 'errors.min_amount',
  MAX_AMOUNT: 'errors.max_amount',

  // Request errors
  INVALID_REQUEST: 'errors.invalid_request',

  // Generic
  UNKNOWN_ERROR: 'errors.unknown_error',
} as const;

export type PaymentErrorKey = (typeof PAYMENT_ERROR_KEYS)[keyof typeof PAYMENT_ERROR_KEYS];

/**
 * Message keys for user-facing instructions (not errors).
 *
 * These are used by strategies to communicate next steps to the user.
 * The UI translates these keys to localized text.
 */
export const PAYMENT_MESSAGE_KEYS = {
  BANK_VERIFICATION_REQUIRED: 'messages.bank_verification_required',
  SPEI_INSTRUCTIONS: 'messages.spei_instructions',
} as const;

export type PaymentMessageKey = (typeof PAYMENT_MESSAGE_KEYS)[keyof typeof PAYMENT_MESSAGE_KEYS];
