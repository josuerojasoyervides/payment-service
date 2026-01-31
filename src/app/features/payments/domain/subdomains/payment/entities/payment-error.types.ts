/**
 * Stable error codes that can be asserted in tests and used for branching decisions
 * outside of UI (e.g., fallback orchestration).
 */
export type PaymentErrorCode =
  | 'invalid_request'
  | 'missing_provider'
  | 'provider_unavailable'
  | 'provider_error'
  | 'network_error'
  | 'timeout'
  | 'processing_timeout'
  | 'unknown_error'
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'requires_action'
  | 'unsupported_client_confirm'
  | 'unsupported_finalize'
  | 'return_correlation_mismatch'
  | 'fallback_handled';

/**
 * Interpolation params for i18n messages.
 * Keep this payload serializable and UI-friendly.
 *
 * Note: Avoid `undefined` in contracts. If a param doesn't exist, omit the key.
 */
export type PaymentErrorParams = Record<string, string | number | boolean | null>;

/**
 * Opaque i18n key used by the UI layer to render an end-user message.
 *
 * This is intentionally not coupled to any concrete i18n implementation/types
 * to keep Domain tech-less. Application/UI can narrow this type via generics.
 */
export type PaymentErrorMessageKey = string;

/**
 * Domain-level error contract.
 *
 * Rules:
 * - `messageKey` is the long-term source of truth for UI copy.
 * - `params` are optional and should be clean (no `undefined` values).
 * - `raw` is never meant to be rendered directly; it is for diagnostics only.
 */
export interface PaymentError<TKey extends PaymentErrorMessageKey = PaymentErrorMessageKey> {
  code: PaymentErrorCode;
  messageKey: TKey;
  params?: PaymentErrorParams;
  raw: unknown;
}
