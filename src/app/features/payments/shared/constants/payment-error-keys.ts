/**
 * Error and message keys for payment flows.
 *
 * These are opaque strings that the UI layer translates via i18n.
 * Convention: keys must match entries in en.ts/es.ts translation files.
 *
 * Kept in Shared (not Domain) so Domain stays agnostic of UI vocabulary.
 * Strategies use these when building errors/instructions; UI translates via i18n when rendering.
 */
export const PAYMENT_ERROR_KEYS = {
  // Card errors
  CARD_TOKEN_REQUIRED: 'errors.card_token_required',
  CARD_TOKEN_INVALID_FORMAT: 'errors.card_token_invalid_format',
  CARD_DECLINED: 'errors.card_declined',
  INSUFFICIENT_FUNDS: 'errors.insufficient_funds',
  EXPIRED_CARD: 'errors.expired_card',
  INCORRECT_CVC: 'errors.incorrect_cvc',
  INCORRECT_NUMBER: 'errors.incorrect_number',
  AUTHENTICATION_REQUIRED: 'errors.authentication_required',
  PROCESSING_ERROR: 'errors.processing_error',

  // Amount errors (shared across methods)
  MIN_AMOUNT: 'errors.min_amount',
  MAX_AMOUNT: 'errors.max_amount',
  AMOUNT_INVALID: 'errors.amount_invalid',
  CURRENCY_REQUIRED: 'errors.currency_required',
  CURRENCY_NOT_SUPPORTED: 'errors.currency_not_supported',

  // Request errors
  ORDER_ID_REQUIRED: 'errors.order_id_required',
  INVALID_REQUEST: 'errors.invalid_request',
  METHOD_TYPE_REQUIRED: 'errors.method_type_required',
  RETURN_URL_REQUIRED: 'errors.return_url_required',
  RETURN_URL_INVALID: 'errors.return_url_invalid',
  CANCEL_URL_INVALID: 'errors.cancel_url_invalid',
  CUSTOMER_EMAIL_REQUIRED: 'errors.customer_email_required',
  CUSTOMER_EMAIL_INVALID: 'errors.customer_email_invalid',

  // Generic
  PROVIDER_ERROR: 'errors.provider_error',
  TIMEOUT: 'errors.timeout',
  STRIPE_ERROR: 'errors.stripe_error',
  UNKNOWN_ERROR: 'errors.unknown_error',
} as const;

/**
 * Message keys for user-facing instructions (not errors).
 *
 * Used by strategies to communicate next steps to the user.
 * The UI translates these keys to localized text.
 */
export const PAYMENT_MESSAGE_KEYS = {
  BANK_VERIFICATION_REQUIRED: 'messages.bank_verification_required',
  SPEI_INSTRUCTIONS: 'messages.spei_instructions',
  PAY_WITH_PAYPAL: 'ui.pay_with_paypal',
  PAYPAL_REDIRECT_SECURE_MESSAGE: 'ui.paypal_redirect_secure_message',
  REDIRECTED_TO_PAYPAL: 'ui.redirected_to_paypal',

  // SPEI manual step instructions (displayed in order)
  SPEI_INSTRUCTION_COMPLETE_TRANSFER: 'messages.spei_instruction_complete_transfer',
  SPEI_INSTRUCTION_TRANSFER_EXACT: 'ui.transfer_exact_amount',
  SPEI_INSTRUCTION_KEEP_RECEIPT: 'ui.keep_receipt',
  SPEI_INSTRUCTION_MAKE_TRANSFER: 'messages.spei_instruction_make_transfer',
} as const;

/**
 * UI label keys for SPEI manual step details (CLABE, Reference, Bank, etc.).
 *
 * The strategy uses these as detail.label; the UI translates via i18n when rendering.
 */
export const PAYMENT_SPEI_DETAIL_LABEL_KEYS = {
  CLABE: 'ui.clabe_label',
  REFERENCE: 'ui.reference',
  BANK: 'ui.destination_bank',
  BENEFICIARY: 'ui.beneficiary',
  AMOUNT: 'ui.amount_label',
  EXPIRES_AT: 'ui.reference_expires',
} as const;
