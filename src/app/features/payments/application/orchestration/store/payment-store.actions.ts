import { rxMethod } from '@ngrx/signals/rxjs-interop';
import type { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import type { PaymentsStoreContext } from '@payments/application/orchestration/store/payment-store.types';
import type { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { ignoreElements, pipe, tap } from 'rxjs';

export interface PaymentsStoreDeps {
  stateMachine: PaymentFlowActorService;
}

export function createPaymentsStoreActions(store: PaymentsStoreContext, deps: PaymentsStoreDeps) {
  const startPayment = rxMethod<{
    request: CreatePaymentRequest;
    providerId: PaymentProviderId;
    context?: PaymentFlowContext;
  }>(
    pipe(
      tap(({ request, providerId, context }) => {
        const accepted = deps.stateMachine.send({
          type: 'START',
          providerId,
          request,
          flowContext: context,
        });

        if (!accepted) return;
      }),
      ignoreElements(),
    ),
  );

  const confirmPayment = rxMethod<{
    request: ConfirmPaymentRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      tap(({ request, providerId }) => {
        const accepted = deps.stateMachine.send({
          type: 'CONFIRM',
          providerId,
          intentId: request.intentId,
          returnUrl: request.returnUrl,
        });

        if (!accepted) return;
      }),
      ignoreElements(),
    ),
  );

  const cancelPayment = rxMethod<{
    request: CancelPaymentRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      tap(({ request, providerId }) => {
        const accepted = deps.stateMachine.send({
          type: 'CANCEL',
          providerId,
          intentId: request.intentId,
        });

        if (!accepted) return;
      }),
      ignoreElements(),
    ),
  );

  const refreshPayment = rxMethod<{
    request: GetPaymentStatusRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      tap(({ request, providerId }) => {
        const accepted = deps.stateMachine.send({
          type: 'REFRESH',
          providerId,
          intentId: request.intentId,
        });

        if (!accepted) return;
      }),
      ignoreElements(),
    ),
  );

  return {
    startPayment,
    confirmPayment,
    cancelPayment,
    refreshPayment,
  };
}
