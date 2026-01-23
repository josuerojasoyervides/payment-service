export type PaymentErrorCode =
  | 'invalid_request'
  | 'card_declined'
  | 'requires_action'
  | 'provider_unavailable'
  | 'provider_error'
  | 'network_error'
  | 'timeout'
  | 'unknown_error'
  | 'fallback_handled'
  | 'insufficient_funds'
  | 'expired_card';

export type PaymentErrorParams = Record<string, string | number | boolean | null | undefined>;

export interface PaymentError {
  code: PaymentErrorCode;

  /**
   * i18n key used to render the message in UI.
   * This is the long-term source of truth.
   */
  messageKey: string;

  /**
   * Optional interpolation params for `messageKey`.
   */
  params?: PaymentErrorParams;

  raw: unknown;
}
