import { resolveStatusReference } from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import type {
  PaymentFlowMachineContext,
  PaymentFlowStatesConfig,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';

function toPaymentIntentIdOrNull(
  raw: string | PaymentIntentId | null | undefined,
): PaymentIntentId | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && 'value' in raw) return raw as PaymentIntentId;
  const result = PaymentIntentId.from(raw as string);
  return result.ok ? result.value : null;
}

/**
 * External event reconciliation states.
 */
export const reconcileStates = {
  reconciling: {
    tags: ['loading', 'reconciling'],
    always: [
      {
        guard: 'hasRefreshKeys',
        target: 'reconcilingInvoke',
      },
      {
        target: 'failed',
        actions: 'setExternalEventError',
      },
    ],
  },

  reconcilingInvoke: {
    tags: ['loading', 'reconciling'],
    invoke: {
      src: 'status',
      input: ({ context }: { context: PaymentFlowMachineContext }) => {
        const rawOrVo =
          resolveStatusReference(context.flowContext, context.providerId) ??
          context.intentId ??
          context.intent?.id;
        const intentId = toPaymentIntentIdOrNull(rawOrVo);
        return {
          providerId: context.providerId!,
          intentId: intentId!,
        };
      },
      onDone: { target: 'afterStatus', actions: 'setIntent' },
      onError: [
        {
          guard: 'canRetryStatus',
          target: 'reconcilingRetrying',
          actions: ['incrementStatusRetry', 'clearError'],
        },
        { target: 'failed', actions: 'setError' },
      ],
    },
  },

  reconcilingRetrying: {
    tags: ['loading', 'reconciling'],
    after: {
      statusRetryDelay: { target: 'reconciling' },
    },
  },
} as const satisfies PaymentFlowStatesConfig;
