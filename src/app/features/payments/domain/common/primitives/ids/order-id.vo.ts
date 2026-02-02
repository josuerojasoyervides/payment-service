import type { Result } from '@payments/domain/common/primitives/result.types';

export type OrderIdViolationCode =
  | 'ORDER_ID_EMPTY'
  | 'ORDER_ID_TOO_LONG'
  | 'ORDER_ID_INVALID_CHARSET';

export interface OrderIdViolation {
  code: OrderIdViolationCode;
  meta?: Record<string, number | string>;
}

/**
 * OrderId value object.
 * Represents a unique identifier for an order/purchase.
 *
 * Invariants:
 * - Non-empty after trim
 * - Max 64 characters
 * - Safe charset: [A-Za-z0-9_-] (compatible with SPEI sanitization)
 */
export interface OrderId {
  readonly value: string;
}

const MAX_LENGTH = 64;
const SAFE_CHARSET_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Creates an OrderId value object.
 *
 * @param raw - The raw string identifier
 * @returns Result with OrderId or violations
 */
function from(raw: string): Result<OrderId, OrderIdViolation> {
  const violations: OrderIdViolation[] = [];

  const trimmed = (raw ?? '').trim();

  if (trimmed.length === 0) {
    violations.push({
      code: 'ORDER_ID_EMPTY',
    });
    return { ok: false, violations };
  }

  if (trimmed.length > MAX_LENGTH) {
    violations.push({
      code: 'ORDER_ID_TOO_LONG',
      meta: { length: trimmed.length, max: MAX_LENGTH },
    });
    return { ok: false, violations };
  }

  if (!SAFE_CHARSET_REGEX.test(trimmed)) {
    violations.push({
      code: 'ORDER_ID_INVALID_CHARSET',
      meta: { value: trimmed },
    });
    return { ok: false, violations };
  }

  return {
    ok: true,
    value: { value: trimmed },
  };
}

/**
 * Sanitizes OrderId for SPEI payment concept.
 * Removes non-alphanumeric characters and uppercases.
 */
function sanitizeForSpei(orderId: OrderId): string {
  return orderId.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export const OrderId = {
  from,
  sanitizeForSpei,
  MAX_LENGTH,
};
