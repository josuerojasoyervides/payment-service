import type {
  PaymentFlowEvent,
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow.types';

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
      onError: { target: 'failed', actions: 'setError' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
