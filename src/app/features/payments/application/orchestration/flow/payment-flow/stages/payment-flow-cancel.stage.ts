import type {
  PaymentFlowEvent,
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Cancel invocation states.
 */
export const cancelStates = {
  cancelling: {
    tags: ['loading', 'cancelling'],
    invoke: {
      src: 'cancel',
      input: ({
        context,
        event,
      }: {
        context: PaymentFlowMachineContext;
        event: PaymentFlowEvent;
      }) => {
        if (event.type === 'CANCEL') {
          return { providerId: event.providerId, intentId: event.intentId };
        }

        return {
          providerId: context.providerId!,
          intentId: context.intentId ?? context.intent!.id,
        };
      },
      onDone: { target: 'done', actions: 'setIntent' },
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
} as const satisfies PaymentFlowStatesConfig;
