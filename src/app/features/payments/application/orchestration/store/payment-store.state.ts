import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { INITIAL_FALLBACK_STATE } from '@payments/domain/models/fallback/fallback-state.types';
import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

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
