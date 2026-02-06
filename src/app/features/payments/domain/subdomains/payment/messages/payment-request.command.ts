import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';
import type { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import type { Money } from '@payments/domain/common/primitives/money/money.vo';
/**
 * Provider-agnostic command to create a payment intent.
 *
 * Contract rules:
 * - This request only defines shared inputs. Provider/method specific validation
 *   must happen outside Domain (e.g., in Application/infrastructure adapters).
 * - `metadata` is for diagnostics and tracing only. Do not use it for core logic.
 */
export interface CreatePaymentRequest {
  orderId: OrderId;
  money: Money;

  method: {
    type: PaymentMethodType;
    /**
     * Optional provider token/payment method reference (when applicable).
     * Example: saved payment method id, one-time token, or nonce.
     */
    token?: string;
  };

  returnUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;

  /** Idempotency key for safe retries. Typically generated outside Domain. */
  idempotencyKey: string;

  metadata?: Record<string, unknown>;
}

/** Command to confirm an existing intent, when supported by the selected provider/method. */
export interface ConfirmPaymentRequest {
  intentId: PaymentIntentId;
  returnUrl?: string;
  /** Idempotency key for safe retries. Typically generated outside Domain. */
  idempotencyKey?: string;
}

/** Command to cancel an existing intent, when supported by the selected provider/method. */
export interface CancelPaymentRequest {
  intentId: PaymentIntentId;
  /** Idempotency key for safe retries. Typically generated outside Domain. */
  idempotencyKey?: string;
}

/** Command to fetch the latest intent status from the provider. */
export interface GetPaymentStatusRequest {
  intentId: PaymentIntentId;
  /** Idempotency key for safe retries. Typically generated outside Domain. */
  idempotencyKey?: string;
}
