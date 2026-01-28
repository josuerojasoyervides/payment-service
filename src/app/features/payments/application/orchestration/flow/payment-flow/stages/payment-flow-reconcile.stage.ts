import { resolveStatusReference } from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

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
        intentId:
          resolveStatusReference(context.flowContext, context.providerId) ??
          context.intentId ??
          context.intent!.id,
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
