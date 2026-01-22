import { computed, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
  WritableStateSource,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
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
import { StrategyContext } from '@payments/domain/ports';
import { catchError, filter, Observable, of, pipe, switchMap, tap } from 'rxjs';

import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { CancelPaymentUseCase } from '../use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '../use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '../use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '../use-cases/start-payment.use-case';
import {
  HISTORY_MAX_ENTRIES,
  initialPaymentsState,
  PaymentHistoryEntry,
  PaymentsState,
} from './payment.models';

type PaymentsWritableStore = WritableStateSource<PaymentsState> & {
  history: () => PaymentHistoryEntry[];
};

export const PaymentsStore = signalStore(
  withState<PaymentsState>(initialPaymentsState),

  withComputed((state) => ({
    isLoading: computed(() => state.status() === 'loading'),
    isReady: computed(() => state.status() === 'ready'),
    hasError: computed(() => state.status() === 'error'),

    currentIntent: computed(() => state.intent()),
    currentError: computed(() => state.error()),

    hasPendingFallback: computed(() => state.fallback().status === 'pending'),
    isAutoFallbackInProgress: computed(() => state.fallback().status === 'auto_executing'),
    isFallbackExecuting: computed(
      () => state.fallback().status === 'executing' || state.fallback().status === 'auto_executing',
    ),
    pendingFallbackEvent: computed(() => state.fallback().pendingEvent),
    isAutoFallback: computed(() => state.fallback().isAutoFallback),

    historyCount: computed(() => state.history().length),
    lastHistoryEntry: computed(() => {
      const history = state.history();
      return history.length ? history[history.length - 1] : null;
    }),

    requiresUserAction: computed(() => {
      const intent = state.intent();
      return intent?.status === 'requires_action' || !!intent?.nextAction;
    }),
    isSucceeded: computed(() => state.intent()?.status === 'succeeded'),
    isProcessing: computed(() => state.intent()?.status === 'processing'),
    isFailed: computed(() => state.intent()?.status === 'failed'),

    debugSummary: computed(() => ({
      status: state.status(),
      intentId: state.intent()?.id ?? null,
      provider: state.selectedProvider(),
      fallbackStatus: state.fallback().status,
      isAutoFallback: state.fallback().isAutoFallback,
      historyCount: state.history().length,
    })),
  })),

  withMethods((store) => {
    const fallbackOrchestrator = inject(FallbackOrchestratorService);
    const startPaymentUseCase = inject(StartPaymentUseCase);
    const confirmPaymentUseCase = inject(ConfirmPaymentUseCase);
    const cancelPaymentUseCase = inject(CancelPaymentUseCase);
    const getPaymentStatusUseCase = inject(GetPaymentStatusUseCase);

    // -----------------------------
    // Helpers (limpieza)
    // -----------------------------

    const canSurfaceErrorToUI = () => {
      const snap = store.fallback();
      return snap.status === 'idle' || snap.status === 'failed';
    };

    const applySuccess = (intent: PaymentIntent, providerId?: PaymentProviderId) => {
      patchState(store, { status: 'ready', intent, error: null });

      if (providerId) addToHistory(store, intent, providerId);

      fallbackOrchestrator.notifySuccess();
    };

    const applyError = (error: PaymentError) => {
      if (canSurfaceErrorToUI()) {
        patchState(store, { status: 'error', error, intent: null });
      }
    };

    const run = (op$: Observable<PaymentIntent>, providerId?: PaymentProviderId) =>
      op$.pipe(
        tap((intent) => applySuccess(intent, providerId)),
        catchError((err: PaymentError) => {
          applyError(err);
          return of(null);
        }),
      );

    // -----------------------------
    // rxMethods (ya súper cortos)
    // -----------------------------

    const startPayment = rxMethod<{
      request: CreatePaymentRequest;
      providerId: PaymentProviderId;
      context?: StrategyContext;
    }>(
      pipe(
        tap(({ providerId }) => {
          patchState(store, { status: 'loading', error: null, selectedProvider: providerId });
        }),
        switchMap(({ request, providerId, context }) => {
          patchState(store, { currentRequest: request });

          const wasAutoFallback = store.fallback().status === 'auto_executing';

          return run(
            startPaymentUseCase.execute(request, providerId, context, wasAutoFallback),
            providerId,
          );
        }),
      ),
    );

    const confirmPayment = rxMethod<{
      request: ConfirmPaymentRequest;
      providerId: PaymentProviderId;
    }>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(({ request, providerId }) =>
          run(confirmPaymentUseCase.execute(request, providerId), providerId),
        ),
      ),
    );

    const cancelPayment = rxMethod<{
      request: CancelPaymentRequest;
      providerId: PaymentProviderId;
    }>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(({ request, providerId }) =>
          run(cancelPaymentUseCase.execute(request, providerId), providerId),
        ),
      ),
    );

    const refreshPayment = rxMethod<{
      request: GetPaymentStatusRequest;
      providerId: PaymentProviderId;
    }>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(({ request, providerId }) =>
          run(getPaymentStatusUseCase.execute(request, providerId), providerId),
        ),
      ),
    );

    // -----------------------------
    // fallbackExecute$ (sin loops)
    // -----------------------------

    fallbackOrchestrator.fallbackExecute$
      .pipe(
        filter(
          () =>
            store.fallback().status === 'auto_executing' || store.fallback().status === 'executing',
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ request, provider }) => {
        startPayment({ request, providerId: provider });
      });

    // -----------------------------
    // Public API
    // -----------------------------

    return {
      startPayment,
      confirmPayment,
      cancelPayment,
      refreshPayment,

      selectProvider(providerId: PaymentProviderId) {
        patchState(store, { selectedProvider: providerId });
      },

      executeFallback(providerId: PaymentProviderId) {
        const pendingEvent = store.fallback().pendingEvent;

        if (!pendingEvent) {
          const currentRequest = store.currentRequest();
          if (!currentRequest) return;
          startPayment({ request: currentRequest, providerId });
          return;
        }

        if (!pendingEvent.alternativeProviders.includes(providerId)) return;

        fallbackOrchestrator.respondToFallback({
          eventId: pendingEvent.eventId,
          accepted: true,
          selectedProvider: providerId,
          timestamp: Date.now(),
        });
      },

      cancelFallback() {
        const pendingEvent = store.fallback().pendingEvent;

        if (pendingEvent) {
          fallbackOrchestrator.respondToFallback({
            eventId: pendingEvent.eventId,
            accepted: false,
            timestamp: Date.now(),
          });
          return;
        }

        fallbackOrchestrator.reset();
      },

      clearError() {
        patchState(store, { error: null, status: 'idle' });
      },

      clearHistory() {
        patchState(store, { history: [] });
      },

      reset() {
        fallbackOrchestrator.reset();
        patchState(store, { ...initialPaymentsState });
      },
    };
  }),

  withHooks((store) => ({
    onInit() {
      const fallbackOrchestrator = inject(FallbackOrchestratorService);

      effect(() => {
        patchState(store, { fallback: fallbackOrchestrator.state() });
      });
    },
  })),
);

// -----------------------------
// History helper (igual)
// -----------------------------
function addToHistory(
  store: PaymentsWritableStore,
  intent: PaymentIntent,
  provider: PaymentProviderId,
  error?: PaymentError,
) {
  const entry: PaymentHistoryEntry = {
    intentId: intent.id,
    provider,
    status: intent.status,
    amount: intent.amount,
    currency: intent.currency,
    timestamp: Date.now(),
    error,
  };

  const newHistory = [...store.history(), entry].slice(-HISTORY_MAX_ENTRIES);

  patchState(store, { history: newHistory });
}
