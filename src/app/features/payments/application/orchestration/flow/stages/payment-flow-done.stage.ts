import type { PaymentFlowStatesConfig } from '@payments/application/orchestration/flow/payment-flow.types';

export const doneStates = {
  done: {
    tags: ['ready', 'done'],
    on: {
      RESET: { target: 'idle', actions: 'clear' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
