/**
 * ID Value Objects - Domain primitives for identifiers.
 *
 * These VOs provide validation for common identifiers used across the payment system.
 * They ensure data integrity at domain boundaries.
 *
 * Usage:
 * - PaymentIntentId: For payment intent identifiers (Stripe pi_, PayPal order IDs, etc.)
 * - OrderId: For merchant order identifiers
 *
 * All VOs follow the same pattern:
 * - `Xxx.from(raw)` - Creates VO with validation, returns Result
 * - `xxx.value` - Access raw string value
 * - `Xxx.MAX_LENGTH` - Maximum allowed length
 */
export { OrderId, type OrderIdViolation, type OrderIdViolationCode } from './order-id.vo';
export {
  PaymentIntentId,
  type PaymentIntentIdViolation,
  type PaymentIntentIdViolationCode,
} from './payment-intent-id.vo';
