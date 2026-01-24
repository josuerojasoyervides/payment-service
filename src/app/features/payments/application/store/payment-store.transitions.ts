import { patchState } from '@ngrx/signals';
import { INITIAL_FALLBACK_STATE } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import { PaymentsStoreContext } from './payment-store.types';

/**
 * Transition: marks the store as `loading` right away.
 *
 * Intent:
 * - Used at the beginning of any payment operation (start/confirm/cancel/refresh).
 * - Clears previous UI error immediately (new attempt).
 * - Keeps `selectedProvider/currentRequest` stable if not explicitly provided.
 *
 * Guarantees:
 * - status === 'loading'
 * - error === null
 *
 * Non-goals:
 * - No side-effects (does NOT call orchestrator, gateways, history, etc.)
 */
export function applyLoadingState(
  store: PaymentsStoreContext,
  providerId?: PaymentProviderId,
  request?: CreatePaymentRequest,
): void {
  patchState(store, {
    status: 'loading',
    error: null,

    // Preserve current values unless explicitly overridden
    selectedProvider: providerId ?? store.selectedProvider(),
    currentRequest: request ?? store.currentRequest(),
  });
}

/**
 * Transition: operation succeeded and we have a final domain intent.
 *
 * Intent:
 * - Ends the current operation successfully.
 * - Clears error and request context.
 *
 * Guarantees:
 * - status === 'ready'
 * - intent !== null
 * - error === null
 * - currentRequest === null
 */
export function applyReadyState(store: PaymentsStoreContext, intent: PaymentIntent): void {
  patchState(store, {
    status: 'ready',
    intent,
    error: null,
  });
}

/**
 * Transition: operation failed and error should be surfaced to UI.
 *
 * Intent:
 * - Store enters error state and exposes a normalized PaymentError.
 * - Clears current intent to avoid stale success state.
 *
 * Guarantees:
 * - status === 'error'
 * - intent === null
 * - error !== null
 */
export function applyFailureState(store: PaymentsStoreContext, error: PaymentError): void {
  patchState(store, {
    status: 'error',
    intent: null,
    error,
    currentRequest: null, // ✅ recomiendo limpiar también aquí
  });
}

/**
 * Transition: failure was handled (e.g. fallback was triggered) so UI should not show error.
 *
 * Intent:
 * - The store returns to a neutral "ready" state without an intent.
 * - Used when fallback orchestration decided to take over.
 *
 * Guarantees:
 * - status === 'ready'
 * - intent === null
 * - error === null
 */
export function applySilentFailureState(store: PaymentsStoreContext): void {
  patchState(store, {
    status: 'ready',
    intent: null,
    error: null,
    currentRequest: null, // ✅ recomendado: evita “request colgado”
  });
}

/**
 * Transition: user selects a new provider.
 *
 * Intent:
 * - Resets the current payment flow (status/intent/error/request).
 * - Preserves cross-flow state (history/fallback), since provider selection is not a "full reset".
 *
 * Guarantees:
 * - selectedProvider updated
 * - flow returns to idle
 *
 * Non-goals:
 * - Does NOT clear history or fallback state
 */
export function applySelectedProviderState(
  store: PaymentsStoreContext,
  providerId: PaymentProviderId,
): void {
  patchState(store, {
    selectedProvider: providerId,
    intent: null,
    error: null,
    currentRequest: null,
    status: 'idle',
  });
}

/**
 * Transition: clear current error and return to idle.
 *
 * Intent:
 * - Used after dismissing an error and allowing the user to try again.
 *
 * Guarantees:
 * - status === 'idle'
 * - error === null
 *
 * Note:
 * - Does NOT reset provider/history/fallback
 */
export function clearErrorState(store: PaymentsStoreContext): void {
  patchState(store, {
    status: 'idle',
    error: null,
  });
}

/**
 * Transition: clear payment history only.
 *
 * Intent:
 * - Debug/user action to remove history entries.
 * - Does not affect current flow, provider or fallback.
 */
export function clearHistoryState(store: PaymentsStoreContext): void {
  patchState(store, {
    history: [],
  });
}

/**
 * Transition: reset the payment flow to idle.
 *
 * Intent:
 * - Clears the current flow (intent/error/request/status) but preserves provider selection,
 *   fallback state, and history.
 *
 * Use when:
 * - UI wants to restart checkout but keep user context.
 */
export function resetState(store: PaymentsStoreContext): void {
  patchState(store, {
    status: 'idle',
    intent: null,
    error: null,
    currentRequest: null,
  });
}

/**
 * Transition: full reset to initial store state.
 *
 * Intent:
 * - Equivalent to a "fresh store instance".
 * - Clears everything including provider selection, fallback, and history.
 *
 * Use when:
 * - test setup
 * - logout
 * - hard reset from UI (rare)
 */
export function resetAllState(store: PaymentsStoreContext): void {
  patchState(store, {
    status: 'idle',
    intent: null,
    error: null,
    currentRequest: null,
    fallback: INITIAL_FALLBACK_STATE,
    history: [],
    selectedProvider: null,
  });
}
