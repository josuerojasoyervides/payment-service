import { patchState } from '@ngrx/signals';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import { HISTORY_MAX_ENTRIES } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type { PaymentsStoreContext } from '@payments/application/orchestration/store/payment-store.types';
import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

export function addToHistory(
  store: PaymentsStoreContext,
  intent: PaymentIntent,
  providerId: PaymentProviderId,
  error?: PaymentError,
): void {
  const entry: PaymentHistoryEntry = {
    intentId: intent.id,
    provider: providerId,
    status: intent.status,
    amount: intent.amount,
    currency: intent.currency,
    timestamp: Date.now(),
    ...(error ? { error } : {}),
  };

  const next = [...store.history(), entry].slice(-HISTORY_MAX_ENTRIES);

  patchState(store, {
    history: next,
  });
}
