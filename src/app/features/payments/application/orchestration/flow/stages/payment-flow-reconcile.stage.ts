import type { PaymentFlowMachineContext, PaymentFlowStatesConfig } from '../payment-flow.types';

export const reconcileStates = {
  reconciling: {
    tags: ['loading', 'reconciling'],
    always: [
      {
        guard: 'hasRefreshKeys',
        target: 'reconcilingInvoke',
      },
      {
        target: 'failed',
        actions: 'setExternalEventError',
      },
    ],
  },

  reconcilingInvoke: {
    tags: ['loading', 'reconciling'],
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
          target: 'reconcilingRetrying',
          actions: ['incrementStatusRetry', 'clearError'],
        },
        { target: 'failed', actions: 'setError' },
      ],
    },
  },

  reconcilingRetrying: {
    tags: ['loading', 'reconciling'],
    after: {
      statusRetryDelay: { target: 'reconciling' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
