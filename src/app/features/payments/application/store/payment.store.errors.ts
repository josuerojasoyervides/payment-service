import { I18nKeys } from '@core/i18n';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';

export function isPaymentError(e: unknown): e is PaymentError {
  return !!e && typeof e === 'object' && 'code' in e && 'messageKey' in e;
}

/**
 * Converts an unknown error into a well-formed `PaymentError`.
 *
 * This is the only acceptable place to:
 * - Accept `unknown`
 * - Apply a safe fallback messageKey
 */
export function normalizePaymentError(e: unknown): PaymentError {
  if (isPaymentError(e)) {
    // Always ensure raw exists for debug purposes.
    // NOTE: MessageKey must already be an i18n key at this point.
    return {
      ...e,
      messageKey: e.messageKey,
      raw: e.raw ?? null,
    };
  }

  return {
    code: 'unknown_error',
    messageKey: I18nKeys.errors.unknown_error,
    raw: e,
  };
}
