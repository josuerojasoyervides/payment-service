import type { FallbackState } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.model';
import { INITIAL_FALLBACK_STATE } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.model';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

/**
 * Possible payment flow states in the UI.
 */
export type PaymentFlowStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Main payments module state.
 */
export interface PaymentsState {
  /** Current payment state */
  status: PaymentFlowStatus;

  /** Current payment intent (if any) */
  intent: PaymentIntent | null;

  /** Current error (if any) */
  error: PaymentError | null;

  /** Currently selected provider */
  selectedProvider: PaymentProviderId | null;

  /** Current request in progress */
  currentRequest: CreatePaymentRequest | null;

  /** Fallback system state */
  fallback: FallbackState;

  /** Intent history for debugging */
  history: PaymentHistoryEntry[];
}

/**
 * Initial payments store state.
 */
export const initialPaymentsState: PaymentsState = {
  status: 'idle',
  intent: null,
  error: null,
  selectedProvider: null,
  currentRequest: null,
  fallback: INITIAL_FALLBACK_STATE,
  history: [],
};
