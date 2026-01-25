import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import {
  catchError,
  EMPTY,
  ignoreElements,
  MonoTypeOperatorFunction,
  Observable,
  pipe,
  tap,
} from 'rxjs';

import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { PaymentFlowActorService } from '../state-machine/payment-flow.actor.service';
import { GetPaymentStatusUseCase } from '../use-cases/get-payment-status.use-case';
import { normalizePaymentError } from './payment-store.errors';
import { addToHistory } from './payment-store.history';
import {
  applyFailureState,
  applyLoadingState,
  applyReadyState,
  applySilentFailureState,
} from './payment-store.transitions';
import { PaymentsStoreContext, RunOptions } from './payment-store.types';

export interface PaymentsStoreDeps {
  fallbackOrchestrator: FallbackOrchestratorService;
  getPaymentStatusUseCase: GetPaymentStatusUseCase; // legacy refresh
  stateMachine: PaymentFlowActorService;
}

export function createPaymentsStoreActions(store: PaymentsStoreContext, deps: PaymentsStoreDeps) {
  const canSurfaceErrorToUI = (fallback: FallbackState) =>
    fallback.status === 'idle' || fallback.status === 'failed';

  const legacyOnSuccess = (providerId: PaymentProviderId) =>
    tap((intent: PaymentIntent) => {
      applyReadyState(store, intent);
      addToHistory(store, intent, providerId);

      if (store.fallback().status !== 'idle') {
        deps.fallbackOrchestrator.notifySuccess();
      }
    });

  const legacyRun = <T>(options: RunOptions = {}): MonoTypeOperatorFunction<T> =>
    pipe(
      tap({
        subscribe: () => {
          applyLoadingState(store, options.providerId, options.request);
        },
      }),
      catchError((rawError: unknown) => {
        const error = normalizePaymentError(rawError);

        if (options.allowFallback && options.providerId && options.request) {
          const handled = deps.fallbackOrchestrator.reportFailure(
            options.providerId,
            error,
            options.request,
            options.wasAutoFallback ?? false,
          );

          if (handled) {
            applySilentFailureState(store);
            return EMPTY as Observable<T>;
          }
        }

        if (canSurfaceErrorToUI(store.fallback())) {
          applyFailureState(store, error);
        }

        return EMPTY as Observable<T>;
      }),
    );

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

        if (!accepted) {
          deps.getPaymentStatusUseCase
            .execute(request, providerId)
            .pipe(legacyRun({ providerId }), legacyOnSuccess(providerId))
            .subscribe();
          return;
        }

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
