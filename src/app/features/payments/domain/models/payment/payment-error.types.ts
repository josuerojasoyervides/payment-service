export type PaymentErrorCode =
  | 'invalid_request'
  | 'card_declined'
  | 'requires_action'
  | 'provider_unavailable'
  | 'provider_error'
  | 'unknown_error'
  | 'fallback_handled';

export type PaymentErrorParams = Record<string, string | number | boolean | null | undefined>;

export interface PaymentError {
  code: PaymentErrorCode;

  /**
   * Human readable error message.
   *
   * ⚠️ Transitional field.
   * During i18n migration, infra may still set this translated string.
   * The end goal is for UI to render from `messageKey` + `params`.
   */
  message: string;

  /**
   * i18n key used to render the message in UI.
   * This is the long-term source of truth.
   */
  messageKey?: string;

  /**
   * Optional interpolation params for `messageKey`.
   */
  params?: PaymentErrorParams;

  raw: unknown;
}
