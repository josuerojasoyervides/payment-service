import type { Result } from '@payments/domain/common/primitives/result.types';

export type PaymentIntentIdViolationCode =
  | 'PAYMENT_INTENT_ID_EMPTY'
  | 'PAYMENT_INTENT_ID_TOO_LONG'
  | 'PAYMENT_INTENT_ID_INVALID_CHARSET';

export interface PaymentIntentIdViolation {
  code: PaymentIntentIdViolationCode;
  meta?: Record<string, number | string>;
}

/**
 * PaymentIntentId value object.
 * Represents a unique identifier for a payment intent across providers.
 *
 * Invariants:
 * - Non-empty after trim
 * - Max 255 characters
 * - Safe charset: [A-Za-z0-9_-]
 *
 * NOTE: Provider-specific prefixes (e.g., Stripe's `pi_`) are NOT validated here.
 * That validation belongs in Infrastructure layer to avoid coupling Domain to providers.
 */
export interface PaymentIntentId {
  readonly value: string;
}

const MAX_LENGTH = 255;
const SAFE_CHARSET_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Creates a PaymentIntentId value object.
 *
 * @param raw - The raw string identifier
 * @returns Result with PaymentIntentId or violations
 */
function from(raw: string): Result<PaymentIntentId, PaymentIntentIdViolation> {
  const violations: PaymentIntentIdViolation[] = [];

  const trimmed = (raw ?? '').trim();

  if (trimmed.length === 0) {
    violations.push({
      code: 'PAYMENT_INTENT_ID_EMPTY',
    });
    return { ok: false, violations };
  }

  if (trimmed.length > MAX_LENGTH) {
    violations.push({
      code: 'PAYMENT_INTENT_ID_TOO_LONG',
      meta: { length: trimmed.length, max: MAX_LENGTH },
    });
    return { ok: false, violations };
  }

  if (!SAFE_CHARSET_REGEX.test(trimmed)) {
    violations.push({
      code: 'PAYMENT_INTENT_ID_INVALID_CHARSET',
      meta: { value: trimmed },
    });
    return { ok: false, violations };
  }

  return {
    ok: true,
    value: { value: trimmed },
  };
}

export const PaymentIntentId = {
  from,
  MAX_LENGTH,
};
