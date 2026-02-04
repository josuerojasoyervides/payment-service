import type { PaymentFlowStatesConfig } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Terminal completion states.
 */
export const doneStates = {
  done: {
    tags: ['ready', 'done'],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
