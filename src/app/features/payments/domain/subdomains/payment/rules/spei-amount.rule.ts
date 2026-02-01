import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';

/**
 * SPEI amount limits (Mexican regulation).
 * Pure domain rule — no i18n, no throws.
 */
export const SPEI_MIN_AMOUNT_MXN = 1;
export const SPEI_MAX_AMOUNT_MXN = 8_000_000;

export type SpeiAmountViolationCode =
  | 'SPEI_INVALID_CURRENCY'
  | 'SPEI_AMOUNT_TOO_LOW'
  | 'SPEI_AMOUNT_TOO_HIGH';

export interface SpeiAmountViolation {
  code: SpeiAmountViolationCode;
  /** For translation params: amount, currency, min, max */
  meta?: Record<string, number | string>;
}

export interface SpeiAmountInput {
  amount: number;
  currency: CurrencyCode;
}

/**
 * Validates SPEI amount and currency.
 *
 * @returns Array of violations; empty if valid
 */
export function validateSpeiAmount(input: SpeiAmountInput): SpeiAmountViolation[] {
  const violations: SpeiAmountViolation[] = [];

  if (input.currency !== 'MXN') {
    violations.push({
      code: 'SPEI_INVALID_CURRENCY',
      meta: { currency: input.currency },
    });
    return violations; // No point checking amount if currency is wrong
  }

  if (input.amount < SPEI_MIN_AMOUNT_MXN) {
    violations.push({
      code: 'SPEI_AMOUNT_TOO_LOW',
      meta: {
        amount: input.amount,
        currency: input.currency,
        min: SPEI_MIN_AMOUNT_MXN,
      },
    });
  }

  if (input.amount > SPEI_MAX_AMOUNT_MXN) {
    violations.push({
      code: 'SPEI_AMOUNT_TOO_HIGH',
      meta: {
        amount: input.amount,
        currency: input.currency,
        max: SPEI_MAX_AMOUNT_MXN,
      },
    });
  }

  return violations;
}

/**
 * Returns SPEI limits for MXN.
 */
export function getSpeiLimitsMxn(): { min: number; max: number } {
  return { min: SPEI_MIN_AMOUNT_MXN, max: SPEI_MAX_AMOUNT_MXN };
}
