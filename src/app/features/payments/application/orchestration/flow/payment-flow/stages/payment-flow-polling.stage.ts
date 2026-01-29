import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

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
        // If we cannot poll anymore according to policy, let afterStatus
        // handle the terminal transition on the next status resolution.
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
