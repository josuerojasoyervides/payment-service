import { WritableStateSource } from '@ngrx/signals';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import { PaymentHistoryEntry } from './payment-store.history.types';
import { PaymentFlowStatus, PaymentsState } from './payment-store.state';

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
