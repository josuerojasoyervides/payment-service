import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { ignoreElements, pipe, tap } from 'rxjs';

import { PaymentFlowActorService } from '../state-machine/payment-flow.actor.service';
import { applyLoadingState } from './payment-store.transitions';
import { PaymentsStoreContext } from './payment-store.types';

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
        applyLoadingState(store, providerId, request);
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
        applyLoadingState(store, providerId);
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
        applyLoadingState(store, providerId);
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
        applyLoadingState(store, providerId);
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
