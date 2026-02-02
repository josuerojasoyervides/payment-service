import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { Money } from '@payments/domain/common/primitives/money/money.vo';

/**
 * Minimum amount per currency for card payments.
 * Pure domain rule — no i18n, no throws.
 *
 * Business rule: MXN requires 10 minimum; USD (and others) require 1.
 */
export function getCardMinAmount(currency: CurrencyCode): number {
  return currency === 'MXN' ? 10 : 1;
}

export type CardAmountViolationCode = 'CARD_AMOUNT_TOO_LOW';

export interface CardAmountViolation {
  code: CardAmountViolationCode;
  meta?: Record<string, number | string>;
}

/**
 * Validates card payment amount.
 *
 * @returns Array of violations; empty if valid
 */
export function validateCardAmount(input: Money): CardAmountViolation[] {
  const violations: CardAmountViolation[] = [];
  const min = getCardMinAmount(input.currency);

  if (input.amount < min) {
    violations.push({
      code: 'CARD_AMOUNT_TOO_LOW',
      meta: {
        amount: input.amount,
        currency: input.currency,
        min,
      },
    });
  }

  return violations;
}
