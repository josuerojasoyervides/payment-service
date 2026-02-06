import type { NextActionClientConfirm } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * clientConfirming invokes application orchestration (ClientConfirmPort via NextActionOrchestrator).
 * Semantics: onDone => CLIENT_CONFIRM_SUCCEEDED -> reconciling; onError => CLIENT_CONFIRM_FAILED -> failed.
 * No REFRESH fallback; errors normalized to PaymentError in setError.
 */
/**
 * Client confirm invocation states.
 */
export const clientConfirmStates = {
  clientConfirming: {
    tags: ['loading', 'clientConfirming'],
    invoke: {
      src: 'clientConfirm',
      input: ({ context }: { context: PaymentFlowMachineContext }) => {
        const nextAction = context.intent?.nextAction;
        return {
          providerId: context.providerId!,
          flowContext: context.flowContext!,
          action: nextAction as NextActionClientConfirm,
        };
      },
      onDone: { target: 'reconciling', actions: ['setIntent', 'resetClientConfirmRetry'] },
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
        {
          guard: 'shouldRetryClientConfirm',
          target: 'clientConfirmRetrying',
          actions: ['incrementClientConfirmRetry', 'setClientConfirmRetryError'],
        },
        {
          target: 'requiresAction',
          actions: ['setError', 'setClientConfirmRetryError'],
        },
      ],
    },
  },

  clientConfirmRetrying: {
    tags: ['loading', 'clientConfirmRetrying'],
    after: {
      clientConfirmRetryDelay: { target: 'clientConfirming' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
