import type { WritableStateSource } from '@ngrx/signals';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type {
  PaymentFlowStatus,
  PaymentsState,
} from '@payments/application/orchestration/store/projection/payment-store.state';
import type { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

/**
 * Minimal store shape used by internal helpers.
 *
 * NOTE:
 * The actual `PaymentsStore` instance has more methods/signals;
 * here we only describe what we need for strict typing.
 */
export interface PaymentsSelectorsSource {
  status: () => PaymentFlowStatus;
  intent: () => PaymentIntent | null;
  error: () => PaymentError | null;
  selectedProvider: () => PaymentProviderId | null;
  currentRequest: () => CreatePaymentRequest | null;
  fallback: () => FallbackState;
  history: () => PaymentHistoryEntry[];
}

/**
 * Store shape used by action helpers (needs write access for `patchState`).
 */
export type PaymentsStoreContext = WritableStateSource<PaymentsState> & PaymentsSelectorsSource;

export interface RunOptions {
  providerId?: PaymentProviderId;
  request?: CreatePaymentRequest;
  wasAutoFallback?: boolean;
  allowFallback?: boolean;
}
