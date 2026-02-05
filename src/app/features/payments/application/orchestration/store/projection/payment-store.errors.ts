import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentErrorCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';

export function looksLikeI18nKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return value.startsWith('errors.') || value.startsWith('ui.');
}

export function isPaymentError(e: unknown): e is PaymentError {
  return !!e && typeof e === 'object' && 'code' in e;
}

/**
 * Converts an unknown error into a well-formed `PaymentError`.
 *
 * This is the only acceptable place to:
 * - Accept `unknown`
 * - Normalize shape for storage/logging
 */
export function normalizePaymentError(e: unknown): PaymentError {
  if (isPaymentError(e)) {
    const messageKey = looksLikeI18nKey(e.messageKey) ? e.messageKey : undefined;

    const normalized: PaymentError = {
      code: e.code as PaymentErrorCode,
      raw: e.raw ?? null,
      ...(e.params ? { params: e.params } : {}),
    };

    return messageKey ? { ...normalized, messageKey } : normalized;
  }

  return {
    code: 'unknown_error',
    raw: e,
  };
}
