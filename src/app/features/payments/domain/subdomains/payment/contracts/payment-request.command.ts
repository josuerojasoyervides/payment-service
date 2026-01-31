import type {
  CurrencyCode,
  PaymentMethodType,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

/**
 * Provider-agnostic command to create a payment intent.
 *
 * Contract rules:
 * - This request only defines shared inputs. Provider/method specific validation
 *   must happen outside Domain (e.g., in Application/infrastructure adapters).
 * - `metadata` is for diagnostics and tracing only. Do not use it for core logic.
 */
export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  currency: CurrencyCode;

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
  idempotencyKey?: string;

  metadata?: Record<string, unknown>;
}

/** Command to confirm an existing intent, when supported by the selected provider/method. */
export interface ConfirmPaymentRequest {
  intentId: string;
  returnUrl?: string;
  /** Idempotency key for safe retries. Typically generated outside Domain. */
  idempotencyKey?: string;
}

/** Command to cancel an existing intent, when supported by the selected provider/method. */
export interface CancelPaymentRequest {
  intentId: string;
  /** Idempotency key for safe retries. Typically generated outside Domain. */
  idempotencyKey?: string;
}

/** Command to fetch the latest intent status from the provider. */
export interface GetPaymentStatusRequest {
  intentId: string;
  /** Idempotency key for safe retries. Typically generated outside Domain. */
  idempotencyKey?: string;
}
