import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Finalize invocation states after external returns.
 */
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
      onError: [
        {
          guard: 'isUnsupportedFinalizeError',
          target: 'reconciling',
          actions: 'clearError',
        },
        { target: 'failed', actions: 'setError' },
      ],
    },
  },
} as const satisfies PaymentFlowStatesConfig;
