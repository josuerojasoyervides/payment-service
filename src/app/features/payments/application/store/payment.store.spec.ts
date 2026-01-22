import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { from, of, Subject, throwError } from 'rxjs';

import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { CancelPaymentUseCase } from '../use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '../use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '../use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '../use-cases/start-payment.use-case';
import { HISTORY_MAX_ENTRIES, initialPaymentsState } from './payment.models';
import { PaymentsStore } from './payment.store';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('PaymentsStore', () => {
  let store: InstanceType<typeof PaymentsStore>;

  const req: CreatePaymentRequest = {
    orderId: 'o1',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: 'tok_123' },
  };

  const intent: PaymentIntent = {
    id: 'pi_1',
    provider: 'stripe',
    status: 'processing',
    amount: 100,
    currency: 'MXN',
  };

  const paymentError: PaymentError = {
    code: 'provider_error',
    message: 'boom',
    raw: {},
  };

  // -------------------
  // Orchestrator mock
  // -------------------
  const fallbackExecute$ = new Subject<{
    request: CreatePaymentRequest;
    provider: PaymentProviderId;
  }>();

  let fallbackState: any;

  const fallbackOrchestratorMock = {
    state: vi.fn(() => fallbackState),
    reportFailure: vi.fn(() => false),
    notifySuccess: vi.fn(),
    respondToFallback: vi.fn(),
    reset: vi.fn(),
    fallbackExecute$: fallbackExecute$.asObservable(),
  };

  // -------------------
  // Use Cases mocks
  // -------------------
  const startPaymentUseCaseMock = {
    execute: vi.fn(() => of(intent)),
  };

  const confirmPaymentUseCaseMock = {
    execute: vi.fn(() => of(intent)),
  };

  const cancelPaymentUseCaseMock = {
    execute: vi.fn(() => of({ ...intent, status: 'canceled' as const })),
  };

  const getPaymentStatusUseCaseMock = {
    execute: vi.fn(() => of({ ...intent, status: 'requires_action' as const })),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    fallbackState = {
      status: 'idle',
      pendingEvent: null,
      failedAttempts: [],
      currentProvider: null,
      isAutoFallback: false,
    };

    TestBed.configureTestingModule({
      providers: [
        PaymentsStore,

        { provide: FallbackOrchestratorService, useValue: fallbackOrchestratorMock },

        { provide: StartPaymentUseCase, useValue: startPaymentUseCaseMock },
        { provide: ConfirmPaymentUseCase, useValue: confirmPaymentUseCaseMock },
        { provide: CancelPaymentUseCase, useValue: cancelPaymentUseCaseMock },
        { provide: GetPaymentStatusUseCase, useValue: getPaymentStatusUseCaseMock },
      ],
    });

    store = TestBed.inject(PaymentsStore);
  });

  describe('initial state', () => {
    it('starts with initial state', () => {
      expect(store.status()).toBe(initialPaymentsState.status);
      expect(store.intent()).toBeNull();
      expect(store.error()).toBeNull();
      expect(store.selectedProvider()).toBeNull();
      expect(store.currentRequest()).toBeNull();
      expect(store.history()).toEqual([]);
    });
  });

  describe('startPayment', () => {
    it('startPayment -> sets loading immediately + selectedProvider + clears error', async () => {
      startPaymentUseCaseMock.execute.mockReturnValueOnce(from(Promise.resolve(intent)));

      patchState(store as any, { status: 'error', error: paymentError });

      store.startPayment({ request: req, providerId: 'stripe' });

      // ✅ loading sí existe antes de resolver el microtask
      expect(store.status()).toBe('loading');
      expect(store.error()).toBeNull();
      expect(store.selectedProvider()).toBe('stripe');

      await flush(); // ✅ ya llega a ready
      expect(store.status()).toBe('ready');
    });

    it('startPayment -> success sets ready + intent + history + currentRequest', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });

      await flush();

      expect(startPaymentUseCaseMock.execute).toHaveBeenCalledTimes(1);

      expect(store.status()).toBe('ready');
      expect(store.intent()).not.toBeNull();
      expect(store.intent()!.id).toBe('pi_1');
      expect(store.error()).toBeNull();

      expect(store.currentRequest()).toEqual(req);

      expect(store.history().length).toBe(1);
      expect(store.history()[0].provider).toBe('stripe');
      expect(store.history()[0].intentId).toBe('pi_1');
    });

    it('startPayment -> error WITHOUT fallback sets status=error + error + intent null', async () => {
      startPaymentUseCaseMock.execute.mockReturnValueOnce(throwError(() => paymentError));
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(false);

      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
      expect(store.intent()).toBeNull();
    });

    it('startPayment -> error WITH fallback handled becomes ready without error and without intent', async () => {
      startPaymentUseCaseMock.execute.mockReturnValueOnce(throwError(() => paymentError));
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(true);

      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('ready');
      expect(store.error()).toBeNull();
      expect(store.intent()).toBeNull();
    });

    it('startPayment -> calls reportFailure with proper args when allowFallback=true', async () => {
      startPaymentUseCaseMock.execute.mockReturnValueOnce(throwError(() => paymentError));
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(false);

      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledWith(
        'stripe',
        paymentError,
        req,
        false,
      );
    });

    it('startPayment -> passes wasAutoFallback=true when store fallback status is auto_executing', async () => {
      // Simula que el store está corriendo un auto fallback ya
      patchState(store as any, {
        fallback: {
          ...store.fallback(),
          status: 'auto_executing',
          isAutoFallback: true,
        },
      });

      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      expect(startPaymentUseCaseMock.execute).toHaveBeenCalledWith(
        req,
        'stripe',
        undefined,
        true, // 👈 wasAutoFallback
      );
    });
  });

  describe('confirmPayment', () => {
    it('confirmPayment -> success sets ready + intent + history', async () => {
      store.confirmPayment({ request: { intentId: 'pi_1' } as any, providerId: 'stripe' });
      await flush();

      expect(confirmPaymentUseCaseMock.execute).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('ready');
      expect(store.intent()).not.toBeNull();
      expect(store.history().length).toBe(1);
    });

    it('confirmPayment -> error does NOT call reportFailure (no fallback here)', async () => {
      confirmPaymentUseCaseMock.execute.mockReturnValueOnce(throwError(() => paymentError));

      store.confirmPayment({ request: { intentId: 'pi_1' } as any, providerId: 'stripe' });
      await flush();

      expect(fallbackOrchestratorMock.reportFailure).not.toHaveBeenCalled();
      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });
  });

  describe('cancelPayment', () => {
    it('cancelPayment -> success sets ready + canceled intent', async () => {
      store.cancelPayment({ request: { intentId: 'pi_1' } as any, providerId: 'stripe' });
      await flush();

      expect(cancelPaymentUseCaseMock.execute).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('ready');
      expect(store.intent()!.status).toBe('canceled');
    });

    it('cancelPayment -> error sets status=error + error', async () => {
      cancelPaymentUseCaseMock.execute.mockReturnValueOnce(throwError(() => paymentError));

      store.cancelPayment({ request: { intentId: 'pi_1' } as any, providerId: 'stripe' });
      await flush();

      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });
  });

  describe('refreshPayment', () => {
    it('refreshPayment -> success sets ready + intent', async () => {
      store.refreshPayment({ request: { intentId: 'pi_1' } as any, providerId: 'stripe' });
      await flush();

      expect(getPaymentStatusUseCaseMock.execute).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('ready');
      expect(store.intent()).not.toBeNull();
    });

    it('refreshPayment -> error sets status=error + error', async () => {
      getPaymentStatusUseCaseMock.execute.mockReturnValueOnce(throwError(() => paymentError));

      store.refreshPayment({ request: { intentId: 'pi_1' } as any, providerId: 'stripe' });
      await flush();

      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });
  });

  describe('fallbackExecute$', () => {
    it('fallbackExecute$ triggers startPayment ONLY when orchestrator status is executing', async () => {
      startPaymentUseCaseMock.execute.mockClear();

      // first call from normal start
      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      // orchestrator executing
      fallbackState = { ...fallbackState, status: 'executing' };

      // emit fallback execution
      fallbackExecute$.next({ request: req, provider: 'paypal' });
      await flush();

      expect(startPaymentUseCaseMock.execute).toHaveBeenCalledTimes(2);

      expect(startPaymentUseCaseMock.execute).toHaveBeenNthCalledWith(
        2,
        req,
        'paypal',
        undefined,
        false,
      );
    });

    it('fallbackExecute$ triggers startPayment ONLY when orchestrator status is auto_executing', async () => {
      startPaymentUseCaseMock.execute.mockClear();

      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      fallbackState = { ...fallbackState, status: 'auto_executing', isAutoFallback: true };

      fallbackExecute$.next({ request: req, provider: 'paypal' });
      await flush();

      expect(startPaymentUseCaseMock.execute).toHaveBeenCalledTimes(2);
    });

    it('fallbackExecute$ does nothing when orchestrator status is idle', async () => {
      startPaymentUseCaseMock.execute.mockClear();

      fallbackState = { ...fallbackState, status: 'idle' };

      fallbackExecute$.next({ request: req, provider: 'paypal' });
      await flush();

      expect(startPaymentUseCaseMock.execute).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('history is capped to HISTORY_MAX_ENTRIES', async () => {
      // Asegura que cada call agrega entry
      for (let i = 0; i < HISTORY_MAX_ENTRIES + 5; i++) {
        startPaymentUseCaseMock.execute.mockReturnValueOnce(
          of({ ...intent, id: `pi_${i}` } satisfies PaymentIntent),
        );

        store.startPayment({ request: req, providerId: 'stripe' });
        await flush();
      }

      expect(store.history().length).toBe(HISTORY_MAX_ENTRIES);
      expect(store.history()[0].intentId).toBe(`pi_${5}`); // los primeros se “recortan”
      expect(store.history()[HISTORY_MAX_ENTRIES - 1].intentId).toBe(
        `pi_${HISTORY_MAX_ENTRIES + 4}`,
      );
    });
  });

  describe('Public API: selectProvider / clear / reset', () => {
    it('selectProvider sets selectedProvider', () => {
      store.selectProvider('paypal');
      expect(store.selectedProvider()).toBe('paypal');
    });

    it('clearError sets status idle + clears error', () => {
      patchState(store as any, { status: 'error', error: paymentError });

      store.clearError();

      expect(store.status()).toBe('idle');
      expect(store.error()).toBeNull();
    });

    it('clearHistory empties history', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      expect(store.history().length).toBe(1);

      store.clearHistory();
      expect(store.history()).toEqual([]);
    });

    it('reset clears store + calls orchestrator.reset', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      store.reset();

      expect(fallbackOrchestratorMock.reset).toHaveBeenCalledTimes(1);

      expect(store.status()).toBe(initialPaymentsState.status);
      expect(store.intent()).toBeNull();
      expect(store.error()).toBeNull();
      expect(store.history()).toEqual([]);
      expect(store.selectedProvider()).toBeNull();
    });
  });

  describe('executeFallback', () => {
    it('executeFallback without pendingEvent uses currentRequest and starts payment with chosen provider', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });
      await flush();

      startPaymentUseCaseMock.execute.mockClear();

      store.executeFallback('paypal');
      await flush();

      expect(startPaymentUseCaseMock.execute).toHaveBeenCalledTimes(1);
      expect(startPaymentUseCaseMock.execute).toHaveBeenCalledWith(req, 'paypal', undefined, false);
    });

    it('executeFallback with pendingEvent calls respondToFallback accepted true', () => {
      const pendingEvent = {
        eventId: 'evt_1',
        alternativeProviders: ['paypal'],
        originalRequest: req,
        failedProvider: 'stripe',
        error: paymentError,
        timestamp: Date.now(),
      };

      patchState(store as any, {
        fallback: {
          ...store.fallback(),
          status: 'pending',
          pendingEvent,
        },
      });

      store.executeFallback('paypal');

      expect(fallbackOrchestratorMock.respondToFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt_1',
          accepted: true,
          selectedProvider: 'paypal',
        }),
      );
    });

    it('executeFallback ignores provider not in alternatives', () => {
      const pendingEvent = {
        eventId: 'evt_1',
        alternativeProviders: ['paypal'],
        originalRequest: req,
        failedProvider: 'stripe',
        error: paymentError,
        timestamp: Date.now(),
      };

      patchState(store as any, {
        fallback: {
          ...store.fallback(),
          status: 'pending',
          pendingEvent,
        },
      });

      store.executeFallback('stripe'); // not allowed

      expect(fallbackOrchestratorMock.respondToFallback).not.toHaveBeenCalled();
    });
  });

  describe('cancelFallback', () => {
    it('cancelFallback with pendingEvent responds accepted=false', () => {
      const pendingEvent = {
        eventId: 'evt_1',
        alternativeProviders: ['paypal'],
        originalRequest: req,
        failedProvider: 'stripe',
        error: paymentError,
        timestamp: Date.now(),
      };

      patchState(store as any, {
        fallback: {
          ...store.fallback(),
          status: 'pending',
          pendingEvent,
        },
      });

      store.cancelFallback();

      expect(fallbackOrchestratorMock.respondToFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt_1',
          accepted: false,
        }),
      );
    });

    it('cancelFallback without pendingEvent calls orchestrator.reset', () => {
      patchState(store as any, {
        fallback: {
          ...store.fallback(),
          status: 'idle',
          pendingEvent: null,
        },
      });

      store.cancelFallback();

      expect(fallbackOrchestratorMock.reset).toHaveBeenCalledTimes(1);
    });
  });
});
