import type { PaymentFlowStatesConfig } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Resilience-specific states (circuit breaker, rate limiting, manual review, etc.).
 */
export const resilienceStates = {
  circuitOpen: {
    tags: ['ready', 'resilience', 'circuitOpen'],
    after: {
      circuitCooldown: { target: 'circuitHalfOpen' },
    },
    on: {
      RESET: { target: 'idle', actions: 'clear' },
    },
  },

  circuitHalfOpen: {
    tags: ['loading', 'resilience', 'circuitHalfOpen'],
    always: [
      { guard: 'hasPendingRequest', target: 'starting', actions: 'setStartFromContext' },
      { target: 'idle', actions: 'clearResilience' },
    ],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
    },
  },

  rateLimited: {
    tags: ['ready', 'resilience', 'rateLimited'],
    after: {
      rateLimitCooldown: { target: 'idle', actions: 'clearResilience' },
    },
    on: {
      RESET: { target: 'idle', actions: 'clear' },
    },
  },

  pendingManualReview: {
    tags: ['ready', 'resilience', 'pendingManualReview'],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
    },
  },

  allProvidersUnavailable: {
    tags: ['ready', 'resilience', 'allProvidersUnavailable'],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
