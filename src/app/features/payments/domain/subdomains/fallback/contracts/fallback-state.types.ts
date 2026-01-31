import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { FallbackAvailableEvent } from '@payments/domain/subdomains/fallback/contracts/fallback-event.event';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

/**
 * Fallback process status.
 */
export type FallbackStatus =
  | 'idle'
  | 'pending'
  | 'executing'
  | 'auto_executing'
  | 'completed'
  | 'cancelled'
  | 'failed';

/**
 * Fallback operation mode.
 */
export type FallbackMode = 'manual' | 'auto';

/**
 * Information about a failed payment attempt.
 */
export interface FailedAttempt {
  /** Provider that failed */
  provider: PaymentProviderId;

  /** Error that caused the failure */
  error: PaymentError;

  /** Failure timestamp */
  timestamp: number;

  /** Whether this attempt was an auto-fallback */
  wasAutoFallback: boolean;
}

/**
 * Complete fallback system state.
 */
export interface FallbackState {
  /** Current status */
  status: FallbackStatus;

  /** Pending event (if status is 'pending') */
  pendingEvent: FallbackAvailableEvent | null;

  /** History of failed attempts in current flow */
  failedAttempts: FailedAttempt[];

  /** Currently executing provider */
  currentProvider: PaymentProviderId | null;

  /** Whether current fallback is automatic */
  isAutoFallback: boolean;

  /** Original payment request */
  originalRequest: CreatePaymentRequest | null;
}

/**
 * Initial fallback state.
 */
export const INITIAL_FALLBACK_STATE: FallbackState = {
  status: 'idle',
  pendingEvent: null,
  failedAttempts: [],
  currentProvider: null,
  isAutoFallback: false,
  originalRequest: null,
};
