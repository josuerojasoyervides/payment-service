import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
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
  MonoTypeOperatorFunction,
  Observable,
  pipe,
  switchMap,
  tap,
} from 'rxjs';

import { StrategyContext } from '../ports/payment-strategy.port';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { PaymentFlowActorService } from '../state-machine/payment-flow.actor.service';
import { CancelPaymentUseCase } from '../use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '../use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '../use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '../use-cases/start-payment.use-case';
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
  startPaymentUseCase: StartPaymentUseCase;
  confirmPaymentUseCase: ConfirmPaymentUseCase;
  cancelPaymentUseCase: CancelPaymentUseCase;
  getPaymentStatusUseCase: GetPaymentStatusUseCase;
  stateMachine: PaymentFlowActorService;
}

export function createPaymentsStoreActions(store: PaymentsStoreContext, deps: PaymentsStoreDeps) {
  /**
   * Policy: do not surface UI errors while fallback is executing.
   * - idle: ok
   * - failed: ok (fallback attempt ended)
   * - executing/auto_executing: NO (avoid flickering UI error mid-fallback)
   */
  const canSurfaceErrorToUI = (fallback: FallbackState) => {
    return fallback.status === 'idle' || fallback.status === 'failed';
  };

  /**
   * Side-effect: after success, store becomes ready and we persist history.
   * If fallback was active, notify orchestrator that we recovered.
   */
  const onSuccess = (providerId: PaymentProviderId) => {
    return tap((intent: PaymentIntent) => {
      applyReadyState(store, intent);

      addToHistory(store, intent, providerId);

      if (store.fallback().status !== 'idle') {
        deps.fallbackOrchestrator.notifySuccess();
      }
    });
  };

  /**
   * Common operator for all payment operations.
   * - sets loading on subscribe (immediate)
   * - normalizes errors
   * - optionally triggers fallback (start/create only)
   * - applies error state only when allowed by policy
   */
  const run = <T>(options: RunOptions = {}): MonoTypeOperatorFunction<T> => {
    return pipe(
      // ✅ loading must happen immediately (even if stream errors synchronously)
      tap({
        subscribe: () => {
          applyLoadingState(store, options.providerId, options.request);
        },
      }),

      catchError((rawError: unknown) => {
        const error = normalizePaymentError(rawError);

        // Optional fallback hook (only for start/create)
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

        // 👇 do not surface errors to UI while fallback is executing
        if (canSurfaceErrorToUI(store.fallback())) {
          applyFailureState(store, error);
        }

        return EMPTY as Observable<T>;
      }),
    );
  };

  const startPayment = rxMethod<{
    request: CreatePaymentRequest;
    providerId: PaymentProviderId;
    context?: StrategyContext;
  }>(
    pipe(
      switchMap(({ request, providerId, context }) => {
        const wasAutoFallback = store.fallback().status === 'auto_executing';

        deps.stateMachine.send({
          type: 'START',
          providerId,
          request,
          flowContext: context,
        });

        return deps.startPaymentUseCase.execute(request, providerId, context, wasAutoFallback).pipe(
          run({
            providerId,
            request,
            allowFallback: true,
            wasAutoFallback,
          }),
          onSuccess(providerId),
        );
      }),
    ),
  );

  const confirmPayment = rxMethod<{
    request: ConfirmPaymentRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      switchMap(({ request, providerId }) => {
        deps.stateMachine.send({
          type: 'CONFIRM',
          providerId,
          intentId: request.intentId,
          returnUrl: request.returnUrl,
        }); // ✅ shadow

        return deps.confirmPaymentUseCase
          .execute(request, providerId)
          .pipe(run({ providerId }), onSuccess(providerId));
      }),
    ),
  );

  const cancelPayment = rxMethod<{
    request: CancelPaymentRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      switchMap(({ request, providerId }) => {
        deps.stateMachine.send({ type: 'CANCEL', providerId, intentId: request.intentId }); // ✅ shadow
        return deps.cancelPaymentUseCase
          .execute(request, providerId)
          .pipe(run({ providerId }), onSuccess(providerId));
      }),
    ),
  );

  const refreshPayment = rxMethod<{
    request: GetPaymentStatusRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      switchMap(({ request, providerId }) => {
        deps.stateMachine.send({ type: 'REFRESH', providerId, intentId: request.intentId }); // ✅ shadow
        return deps.getPaymentStatusUseCase
          .execute(request, providerId)
          .pipe(run({ providerId }), onSuccess(providerId));
      }),
    ),
  );

  return {
    startPayment,
    confirmPayment,
    cancelPayment,
    refreshPayment,
  };
}
