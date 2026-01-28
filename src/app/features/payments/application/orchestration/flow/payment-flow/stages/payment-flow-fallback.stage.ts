import type { PaymentFlowStatesConfig } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

export const fallbackStates = {
  failed: {
    tags: ['error', 'failed'],
    always: [{ guard: 'canFallback', target: 'fallbackCandidate' }],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
      FALLBACK_REQUESTED: {
        target: 'fallbackCandidate',
        actions: 'setFallbackRequested',
      },
      FALLBACK_EXECUTE: { target: 'starting', actions: 'setFallbackStartInput' },
    },
  },

  fallbackCandidate: {
    tags: ['ready', 'fallbackCandidate', 'fallback'],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
      FALLBACK_EXECUTE: { target: 'starting', actions: 'setFallbackStartInput' },
      FALLBACK_ABORT: { target: 'done', actions: 'clear' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
