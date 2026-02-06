import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Polling loop and status refresh states.
 */
export const pollingStates = {
  polling: {
    tags: ['ready', 'polling'],
    entry: ['incrementPollAttempt'],
    after: {
      pollDelay: [
        {
          guard: 'canPoll',
          target: 'fetchingStatus',
        },
        {
          guard: 'isPollingExhausted',
          target: 'failed',
          actions: 'setProcessingTimeoutError',
        },
      ],
    },
    on: {
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
      CANCEL: { target: 'cancelling' },
    },
  },

  fetchingStatus: {
    tags: ['loading', 'fetchingStatus'],
    always: [
      {
        guard: 'hasRefreshKeys',
        target: 'fetchingStatusInvoke',
      },
      {
        // Missing providerId/intentId indicates a caller bug.
        target: 'failed',
        actions: 'setRefreshError',
      },
    ],
  },

  fetchingStatusInvoke: {
    tags: ['loading', 'fetchingStatusInvoke'],
    invoke: {
      src: 'status',
      input: ({ context }: { context: PaymentFlowMachineContext }) => ({
        providerId: context.providerId!,
        intentId: context.intentId ?? context.intent!.id,
      }),
      onDone: { target: 'afterStatus', actions: 'setIntent' },
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
        {
          guard: 'canRetryStatus',
          target: 'statusRetrying',
          actions: ['incrementStatusRetry', 'clearError'],
        },
        { target: 'failed', actions: 'setError' },
      ],
    },
  },

  afterStatus: {
    tags: ['ready', 'afterStatus'],
    always: [
      { guard: 'needsUserAction', target: 'requiresAction' },
      { guard: 'needsFinalize', target: 'finalizing' },
      { guard: 'isFinal', target: 'done' },
      {
        guard: 'isProcessingTimedOut',
        target: 'failed',
        actions: 'setProcessingTimeoutError',
      },
      { target: 'polling' },
    ],
  },

  statusRetrying: {
    tags: ['loading', 'statusRetrying'],
    after: {
      statusRetryDelay: { target: 'fetchingStatus' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
