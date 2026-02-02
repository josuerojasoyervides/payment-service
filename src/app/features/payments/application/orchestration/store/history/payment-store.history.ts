import { updateState } from '@angular-architects/ngrx-toolkit';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import { HISTORY_MAX_ENTRIES } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type { PaymentsStoreContext } from '@payments/application/orchestration/store/types/payment-store.types';

function isSameAsLast(prev: PaymentHistoryEntry[], next: PaymentHistoryEntry): boolean {
  const last = prev.at(-1);
  if (!last) return false;

  // Ajusta si quieres incluir más campos:
  return (
    last.intentId === next.intentId &&
    last.provider === next.provider &&
    last.status === next.status &&
    last.amount === next.amount &&
    last.currency === next.currency &&
    (last.error?.code ?? null) === (next.error?.code ?? null)
  );
}

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
    amount: intent.money.amount,
    currency: intent.money.currency,
    timestamp: Date.now(),
    ...(error ? { error } : {}),
  };

  updateState(store, 'history/add', (s) => {
    if (isSameAsLast(s.history, entry)) return {}; // no-op
    return { history: [...s.history, entry].slice(-HISTORY_MAX_ENTRIES) };
  });
}
