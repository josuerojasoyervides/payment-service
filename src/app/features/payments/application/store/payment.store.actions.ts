import { patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
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
import { CancelPaymentUseCase } from '../use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '../use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '../use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '../use-cases/start-payment.use-case';
import { normalizePaymentError } from './payment.store.errors';
import { addToHistory } from './payment.store.history';
import { PaymentsStoreContext, RunOptions } from './payment.store.types';

export interface PaymentsStoreDeps {
  fallbackOrchestrator: FallbackOrchestratorService;
  startPaymentUseCase: StartPaymentUseCase;
  confirmPaymentUseCase: ConfirmPaymentUseCase;
  cancelPaymentUseCase: CancelPaymentUseCase;
  getPaymentStatusUseCase: GetPaymentStatusUseCase;
}

export function createPaymentsStoreActions(store: PaymentsStoreContext, deps: PaymentsStoreDeps) {
  const applyLoading = (providerId?: PaymentProviderId, request?: CreatePaymentRequest) => {
    patchState(store, {
      status: 'loading',
      error: null,
      selectedProvider: providerId ?? store.selectedProvider(),
      currentRequest: request ?? store.currentRequest(),
    });
  };

  const applySuccess = (intent: PaymentIntent, providerId: PaymentProviderId) => {
    patchState(store, {
      status: 'ready',
      intent,
      error: null,
    });

    addToHistory(store, intent, providerId);

    // ✅ If fallback was active, notify orchestrator that we recovered.
    if (store.fallback().status !== 'idle') {
      deps.fallbackOrchestrator.notifySuccess();
    }
  };

  const applySilentFailure = () => {
    patchState(store, {
      status: 'ready',
      intent: null,
      error: null,
    });
  };

  const canSurfaceErrorToUI = (fallback: FallbackState) => {
    return fallback.status === 'idle' || fallback.status === 'failed';
  };

  const applyError = (error: PaymentError) => {
    // 👇 NO toca UI mientras fallback está corriendo
    if (!canSurfaceErrorToUI(store.fallback())) return;

    patchState(store, {
      status: 'error',
      intent: null,
      error,
    });
  };

  const run = <T>(options: RunOptions = {}): MonoTypeOperatorFunction<T> => {
    return pipe(
      tap({
        subscribe: () => {
          applyLoading(options.providerId, options.request);
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
            applySilentFailure();
            return EMPTY as Observable<T>;
          }
        }

        applyError(error);
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
        // Detect if we are inside an auto-fallback execution
        const wasAutoFallback = store.fallback().status === 'auto_executing';

        return deps.startPaymentUseCase.execute(request, providerId, context, wasAutoFallback).pipe(
          run<PaymentIntent>({
            providerId,
            request,
            allowFallback: true,
            wasAutoFallback,
          }),
          tap((intent) => {
            applySuccess(intent, providerId);
          }),
        );
      }),
    ),
  );

  const confirmPayment = rxMethod<{
    request: ConfirmPaymentRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      switchMap(({ request, providerId }) =>
        deps.confirmPaymentUseCase.execute(request, providerId).pipe(
          run<PaymentIntent>({ providerId }),
          tap((intent) => applySuccess(intent, providerId)),
        ),
      ),
    ),
  );

  const cancelPayment = rxMethod<{
    request: CancelPaymentRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      switchMap(({ request, providerId }) =>
        deps.cancelPaymentUseCase.execute(request, providerId).pipe(
          run<PaymentIntent>({ providerId }),
          tap((intent) => applySuccess(intent, providerId)),
        ),
      ),
    ),
  );

  const refreshPayment = rxMethod<{
    request: GetPaymentStatusRequest;
    providerId: PaymentProviderId;
  }>(
    pipe(
      switchMap(({ request, providerId }) =>
        deps.getPaymentStatusUseCase.execute(request, providerId).pipe(
          run<PaymentIntent>({ providerId }),
          tap((intent) => applySuccess(intent, providerId)),
        ),
      ),
    ),
  );

  return {
    startPayment,
    confirmPayment,
    cancelPayment,
    refreshPayment,
  };
}
