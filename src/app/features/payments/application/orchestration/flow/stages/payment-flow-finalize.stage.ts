import type { PaymentFlowMachineContext, PaymentFlowStatesConfig } from '../payment-flow.types';

export const finalizeStates = {
  finalizing: {
    tags: ['loading', 'finalizing'],
    invoke: {
      src: 'finalize',
      input: ({ context }: { context: PaymentFlowMachineContext }) => ({
        providerId: context.providerId!,
        flowContext: context.flowContext!,
      }),
      onDone: { target: 'reconciling', actions: 'setIntent' },
      onError: { target: 'failed', actions: 'setError' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
