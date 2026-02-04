import type { PaymentFlowStatesConfig } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Idle state and command entrypoints.
 */
export const idleStates = {
  idle: {
    tags: ['idle'],
    on: {
      START: { target: 'starting', actions: 'setStartInput' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
      CONFIRM: { target: 'confirming', actions: 'setConfirmInput' },
      CANCEL: { target: 'cancelling', actions: 'setCancelInput' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
