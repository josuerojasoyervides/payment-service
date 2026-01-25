import type { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { fromPromise } from 'xstate';

import type {
  CancelInput,
  ConfirmInput,
  PaymentFlowActorLogicMap,
  PaymentFlowDeps,
  StartInput,
  StatusInput,
} from './payment-flow.types';

export function createPaymentFlowActors(deps: PaymentFlowDeps): PaymentFlowActorLogicMap {
  return {
    start: fromPromise<PaymentIntent, StartInput>(async ({ input }) => {
      return deps.startPayment(input.providerId, input.request, input.flowContext);
    }),

    confirm: fromPromise<PaymentIntent, ConfirmInput>(async ({ input }) => {
      return deps.confirmPayment(input.providerId, {
        intentId: input.intentId,
        returnUrl: input.returnUrl,
      });
    }),

    cancel: fromPromise<PaymentIntent, CancelInput>(async ({ input }) => {
      return deps.cancelPayment(input.providerId, { intentId: input.intentId });
    }),

    status: fromPromise<PaymentIntent, StatusInput>(async ({ input }) => {
      return deps.getStatus(input.providerId, { intentId: input.intentId });
    }),
  };
}
