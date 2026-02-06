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
          guard: 'canRetryFinalize',
          target: 'finalizeRetrying',
          actions: ['incrementFinalizeRetry', 'setError'],
        },
        {
          target: 'pendingManualReview',
          actions: ['setError'],
        },
      ],
    },
  },

  finalizeRetrying: {
    tags: ['loading', 'finalizeRetrying'],
    after: {
      finalizeRetryDelay: { target: 'finalizing' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
