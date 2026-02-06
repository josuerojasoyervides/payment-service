import type { PaymentFlowStatesConfig } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Fallback candidate and failure handling states.
 */
export const fallbackStates = {
  failed: {
    tags: ['error', 'failed'],
    always: [{ guard: 'canFallback', target: 'fallbackConfirming' }],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
      FALLBACK_REQUESTED: {
        target: 'fallbackConfirming',
        actions: 'setFallbackRequested',
      },
      FALLBACK_EXECUTE: { target: 'starting', actions: 'setFallbackStartInput' },
    },
  },

  fallbackConfirming: {
    tags: ['ready', 'fallbackConfirming', 'fallback'],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
      FALLBACK_EXECUTE: { target: 'starting', actions: 'setFallbackStartInput' },
      FALLBACK_ABORT: { target: 'done', actions: 'clear' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
