import { patchState } from '@ngrx/signals';
import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

import type { PaymentsStoreContext } from '../payment-store.types';
import type { PaymentHistoryEntry } from './payment-store.history.types';
import { HISTORY_MAX_ENTRIES } from './payment-store.history.types';

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
