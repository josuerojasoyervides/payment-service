import type { NextActionClientConfirm } from '@app/features/payments/domain/subdomains/payment/entities/payment-action.model';
import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * clientConfirming invokes application orchestration (ClientConfirmPort via NextActionOrchestrator).
 * Semantics: onDone => CLIENT_CONFIRM_SUCCEEDED -> reconciling; onError => CLIENT_CONFIRM_FAILED -> failed.
 * No REFRESH fallback; errors normalized to PaymentError in setError.
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
      onDone: { target: 'reconciling', actions: 'setIntent' },
      onError: { target: 'failed', actions: 'setError' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
