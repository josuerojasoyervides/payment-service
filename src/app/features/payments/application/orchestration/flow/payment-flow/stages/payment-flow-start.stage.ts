import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Start and post-start routing states.
 */
export const startStates = {
  starting: {
    tags: ['loading', 'starting'],
    invoke: {
      src: 'start',
      input: ({ context }: { context: PaymentFlowMachineContext }) => ({
        providerId: context.providerId!,
        request: context.request!,
        flowContext: context.flowContext ?? undefined,
      }),
      onDone: { target: 'afterStart', actions: 'setIntent' },
      onError: [
        {
          guard: 'isCircuitOpenError',
          target: 'circuitOpen',
          actions: ['setError', 'setCircuitOpenFromError'],
        },
        {
          guard: 'isRateLimitedError',
          target: 'rateLimited',
          actions: ['setError', 'setRateLimitedFromError'],
        },
        { target: 'failed', actions: 'setError' },
      ],
    },
  },

  afterStart: {
    tags: ['loading', 'afterStart'],
    always: [
      { guard: 'needsUserAction', target: 'requiresAction' },
      { guard: 'isFinal', target: 'done' },
      {
        guard: 'isProcessingTimedOut',
        target: 'failed',
        actions: 'setProcessingTimeoutError',
      },
      { target: 'polling' },
    ],
  },

  requiresAction: {
    tags: ['ready', 'requiresAction'],
    on: {
      CONFIRM: [
        { guard: 'needsClientConfirm', target: 'clientConfirming' },
        { target: 'confirming', actions: 'setConfirmInput' },
      ],
      CANCEL: { target: 'cancelling', actions: 'setCancelInput' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
