import type { NextActionClientConfirm } from '@payments/domain/models/payment/payment-action.types';

import type { PaymentFlowMachineContext, PaymentFlowStatesConfig } from '../payment-flow.types';

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
