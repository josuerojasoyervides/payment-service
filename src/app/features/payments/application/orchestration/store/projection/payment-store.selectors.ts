import { computed } from '@angular/core';

import { PaymentsSelectorsSource } from '../payment-store.types';

/**
 * Store selectors / derived state.
 *
 * Keep this file free of side-effects.
 * These computed signals are "grow-safe" and will map 1:1 to XState later.
 */
export function buildPaymentsSelectors(state: PaymentsSelectorsSource) {
  return {
    // Basic flow status
    isLoading: computed(() => state.status() === 'loading'),
    isReady: computed(() => state.status() === 'ready'),
    hasError: computed(() => state.status() === 'error'),

    // Current intent data
    currentIntent: computed(() => state.intent()),
    currentError: computed(() => state.error()),

    // Intent-specific states
    requiresUserAction: computed(() => {
      const intent = state.intent();
      const action = intent?.nextAction;
      const actionable = action ? action.kind !== 'external_wait' : false;
      return intent?.status === 'requires_action' || actionable;
    }),
    isSucceeded: computed(() => state.intent()?.status === 'succeeded'),
    isProcessing: computed(() => state.intent()?.status === 'processing'),
    isFailed: computed(() => state.intent()?.status === 'failed'),

    // Fallback derived state
    hasPendingFallback: computed(() => state.fallback().status === 'pending'),
    isAutoFallbackInProgress: computed(() => state.fallback().status === 'auto_executing'),
    isFallbackExecuting: computed(
      () => state.fallback().status === 'executing' || state.fallback().status === 'auto_executing',
    ),
    isAutoFallback: computed(() => state.fallback().isAutoFallback),
    pendingFallbackEvent: computed(() => state.fallback().pendingEvent),

    // History
    historyCount: computed(() => state.history().length),
    lastHistoryEntry: computed(() => {
      const list = state.history();
      return list.length ? list[list.length - 1] : null;
    }),

    // Debug summary (single place to inspect state quickly)
    debugSummary: computed(() => ({
      status: state.status(),
      intentId: state.intent()?.id ?? null,
      provider: state.selectedProvider(),
      fallbackStatus: state.fallback().status,
      isAutoFallback: state.fallback().isAutoFallback,
      historyCount: state.history().length,
    })),
  };
}
