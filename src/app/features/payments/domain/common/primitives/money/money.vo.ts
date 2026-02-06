import type { CurrencyCode } from '@app/features/payments/domain/common/primitives/money/currency.types';
import { CURRENCY_CODES } from '@app/features/payments/domain/common/primitives/money/currency.types';
import type { Result } from '@payments/domain/common/primitives/result.types';

export type MoneyViolationCode =
  | 'MONEY_INVALID_AMOUNT'
  | 'MONEY_AMOUNT_NOT_FINITE'
  | 'MONEY_AMOUNT_NEGATIVE_OR_ZERO'
  | 'MONEY_AMOUNT_TOO_MANY_DECIMALS'
  | 'MONEY_INVALID_CURRENCY';

export interface MoneyViolation {
  code: MoneyViolationCode;
  meta?: Record<string, number | string>;
}

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

const MAX_DECIMAL_PLACES = 2;

/**
 * Normalizes amount to max 2 decimal places (major units).
 * Mitigates float precision issues.
 */
function normalizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Counts decimal places in a number.
 */
function decimalPlaces(value: number): number {
  const str = String(value);
  const dot = str.indexOf('.');
  return dot === -1 ? 0 : str.length - dot - 1;
}

/**
 * Creates a Money value object.
 *
 * Invariants:
 * - amount: Number.isFinite, > 0, max 2 decimal places (major units)
 * - currency: member of CURRENCY_CODES
 *
 * @returns Result with Money or violations
 */
function create(amount: number, currency: CurrencyCode): Result<Money, MoneyViolation> {
  const violations: MoneyViolation[] = [];

  if (typeof amount !== 'number') {
    violations.push({
      code: 'MONEY_INVALID_AMOUNT',
      meta: { amount: amount as unknown as number },
    });
    return { ok: false, violations };
  }

  if (!Number.isFinite(amount)) {
    violations.push({
      code: 'MONEY_AMOUNT_NOT_FINITE',
      meta: { amount },
    });
    return { ok: false, violations };
  }

  if (amount <= 0) {
    violations.push({
      code: 'MONEY_AMOUNT_NEGATIVE_OR_ZERO',
      meta: { amount },
    });
    return { ok: false, violations };
  }

  if (decimalPlaces(amount) > MAX_DECIMAL_PLACES) {
    violations.push({
      code: 'MONEY_AMOUNT_TOO_MANY_DECIMALS',
      meta: { amount, max: MAX_DECIMAL_PLACES },
    });
    return { ok: false, violations };
  }

  if (!CURRENCY_CODES.includes(currency)) {
    violations.push({
      code: 'MONEY_INVALID_CURRENCY',
      meta: { currency },
    });
    return { ok: false, violations };
  }

  const normalized = normalizeAmount(amount);
  return {
    ok: true,
    value: {
      amount: normalized,
      currency,
    },
  };
}

export const Money = {
  create,
};
