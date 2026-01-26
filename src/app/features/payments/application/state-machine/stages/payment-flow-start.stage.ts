import type { PaymentFlowMachineContext } from '../payment-flow.types';

export const createStartStates = () => ({
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
      onError: { target: 'failed', actions: 'setError' },
    },
  },

  afterStart: {
    tags: ['loading', 'afterStart'],
    always: [
      { guard: 'needsUserAction', target: 'requiresAction' },
      { guard: 'isFinal', target: 'done' },
      { target: 'polling' },
    ],
  },

  requiresAction: {
    tags: ['ready', 'requiresAction'],
    on: {
      CONFIRM: { target: 'confirming', actions: 'setConfirmInput' },
      CANCEL: { target: 'cancelling', actions: 'setCancelInput' },
      REFRESH: { target: 'fetchingStatus', actions: 'setRefreshInput' },
    },
  },
});
