/**
 * Typed VO helpers for tests and harnesses.
 * Use these to build PaymentIntentId / OrderId quickly without noise in specs.
 * Lives outside Domain; tests may throw on invalid input.
 */
import type { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';
import { OrderId as OrderIdVO } from '@payments/domain/common/primitives/ids/order-id.vo';
import type { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { PaymentIntentId as PaymentIntentIdVO } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';

export function createPaymentIntentId(raw: string): PaymentIntentId {
  const result = PaymentIntentIdVO.from(raw);
  if (!result.ok) {
    throw new Error(`Tests: invalid PaymentIntentId "${raw}": ${result.violations[0]?.code}`);
  }
  return result.value;
}

export function createOrderId(raw: string): OrderId {
  const result = OrderIdVO.from(raw);
  if (!result.ok) {
    throw new Error(`Tests: invalid OrderId "${raw}": ${result.violations[0]?.code}`);
  }
  return result.value;
}
