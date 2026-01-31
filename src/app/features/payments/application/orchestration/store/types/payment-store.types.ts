import type {
  PaymentFlowStatus,
  PaymentsState,
} from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import type { FallbackState } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.types';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { WritableStateSource } from '@ngrx/signals';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

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
