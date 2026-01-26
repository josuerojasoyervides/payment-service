import type { PaymentFlowEvent, PaymentFlowMachineContext } from '../payment-flow.types';

export const createConfirmStates = () => ({
  confirming: {
    tags: ['loading', 'confirming'],
    invoke: {
      src: 'confirm',
      input: ({
        context,
        event,
      }: {
        context: PaymentFlowMachineContext;
        event: PaymentFlowEvent;
      }) => {
        if (event.type === 'CONFIRM') {
          return {
            providerId: event.providerId,
            intentId: event.intentId,
            returnUrl: event.returnUrl,
          };
        }

        return {
          providerId: context.providerId!,
          intentId: context.intentId ?? context.intent!.id,
          returnUrl: context.flowContext?.returnUrl,
        };
      },
      onDone: { target: 'afterConfirm', actions: 'setIntent' },
      onError: { target: 'failed', actions: 'setError' },
    },
  },

  afterConfirm: {
    tags: ['loading', 'afterConfirm'],
    always: [
      { guard: 'needsUserAction', target: 'requiresAction' },
      { guard: 'isFinal', target: 'done' },
      { target: 'polling' },
    ],
  },
});
