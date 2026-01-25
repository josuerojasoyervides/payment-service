import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nKeys } from '@core/i18n';
import { patchState } from '@ngrx/signals';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { of, Subject, throwError } from 'rxjs';

import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
import { PaymentFlowActorService } from '../state-machine/payment-flow.actor.service';
import { GetPaymentStatusUseCase } from '../use-cases/get-payment-status.use-case';
import { PaymentsStore } from './payment-store';
import { HISTORY_MAX_ENTRIES } from './payment-store.history.types';
import { initialPaymentsState } from './payment-store.state';

describe('PaymentsStore', () => {
  let store: InstanceType<typeof PaymentsStore>;

  const flush = async () => {
    TestBed.tick();
    // 1 vuelta de microtasks
    /* await Promise.resolve(); */
    // 2 vueltas por si hay effects encadenados
    /* await Promise.resolve(); */
  };

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
    messageKey: I18nKeys.errors.provider_error,
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
  // Legacy UseCase mock (only for refresh fallback path)
  // -------------------
  const getPaymentStatusUseCaseMock = {
    execute: vi.fn(() => of({ ...intent, status: 'requires_action' as const })),
  };

  // -------------------
  // Machine snapshot mock (source of truth)
  // -------------------
  const machineSnapshot = signal<any>({
    state: 'idle',
    context: {
      providerId: null,
      request: null,
      flowContext: null,
      intent: null,
      error: null,
    },
    lastSentEvent: null,
  });

  const resetMachine = () => {
    machineSnapshot.set({
      state: 'idle',
      context: {
        providerId: null,
        request: null,
        flowContext: null,
        intent: null,
        error: null,
      },
      lastSentEvent: null,
    });
  };

  const setMachineLoading = (overrides?: Partial<any>) => {
    machineSnapshot.set({
      state: 'starting',
      context: {
        providerId: 'stripe',
        request: req,
        flowContext: null,
        intent: null,
        error: null,
        ...overrides,
      },
      lastSentEvent: { type: 'START', providerId: 'stripe', request: req },
    });
  };

  const setMachineReady = (overrides?: Partial<any>) => {
    machineSnapshot.set({
      state: 'done',
      context: {
        providerId: 'stripe',
        request: req,
        flowContext: null,
        intent,
        error: null,
        ...overrides,
      },
      lastSentEvent: { type: 'START', providerId: 'stripe', request: req },
    });
  };

  const setMachineError = (overrides?: Partial<any>) => {
    machineSnapshot.set({
      state: 'failed',
      context: {
        providerId: 'stripe',
        request: req,
        flowContext: null,
        intent: null,
        error: paymentError,
        ...overrides,
      },
      lastSentEvent: { type: 'START', providerId: 'stripe', request: req },
    });
  };

  const stateMachineMock: Partial<PaymentFlowActorService> = {
    snapshot: machineSnapshot as any,
    send: vi.fn((event: any) => {
      if (event?.type === 'REFRESH') return false;
      return true;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMachine();

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
        { provide: PaymentFlowActorService, useValue: stateMachineMock },
        { provide: GetPaymentStatusUseCase, useValue: getPaymentStatusUseCaseMock },
      ],
    });

    store = TestBed.inject(PaymentsStore);
  });

  // ============================================================
  // initial state
  // ============================================================
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

  // ============================================================
  // startPayment
  // ============================================================
  describe('startPayment', () => {
    it('sets loading immediately + then ready after machine emits intent', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });

      // 1) inmediatamente loading
      expect(store.status()).toBe('loading');
      expect(store.error()).toBeNull();
      expect(store.selectedProvider()).toBe('stripe');

      // 2) la máquina produce intent
      setMachineReady();
      await flush();

      expect(store.status()).toBe('ready');
      expect(store.intent()?.id).toBe('pi_1');
      expect(store.history().length).toBe(1);
    });

    it('machine error WITHOUT fallback => status=error + error', async () => {
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(false);

      store.startPayment({ request: req, providerId: 'stripe' });
      expect(store.status()).toBe('loading');

      setMachineError();
      await flush();

      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledTimes(1);
      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });

    it('machine error WITH fallback handled => silent failure (no UI error)', async () => {
      fallbackOrchestratorMock.reportFailure.mockReturnValueOnce(true);

      store.startPayment({ request: req, providerId: 'stripe' });
      expect(store.status()).toBe('loading');

      setMachineError();
      await flush();

      expect(fallbackOrchestratorMock.reportFailure).toHaveBeenCalledTimes(1);

      // policy del bridge: si handled, NO surfear error a UI
      expect(store.error()).toBeNull();
      expect(store.status()).not.toBe('error');
    });

    it('passes wasAutoFallback=true when store fallback status is auto_executing', async () => {
      patchState(store as any, {
        fallback: {
          ...store.fallback(),
          status: 'auto_executing',
          isAutoFallback: true,
        },
      });

      store.startPayment({ request: req, providerId: 'stripe' });

      expect(stateMachineMock.send).toHaveBeenCalledTimes(1);
      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START',
          providerId: 'stripe',
          request: req,
        }),
      );

      // y si la máquina responde ok
      setMachineReady();
      await flush();

      expect(store.status()).toBe('ready');
    });
  });

  // ============================================================
  // confirmPayment
  // ============================================================
  describe('confirmPayment', () => {
    it('success => ready after machine emits intent', async () => {
      store.confirmPayment({
        request: { intentId: 'pi_1' } as any,
        providerId: 'stripe',
      });

      expect(stateMachineMock.send).toHaveBeenCalledTimes(1);
      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CONFIRM',
          providerId: 'stripe',
        }),
      );

      setMachineReady({
        request: { intentId: 'pi_1' },
      });
      await flush();

      expect(store.status()).toBe('ready');
      expect(store.intent()).not.toBeNull();
      expect(store.history().length).toBe(1);
    });

    it('error => status=error after machine emits error', async () => {
      store.confirmPayment({
        request: { intentId: 'pi_1' } as any,
        providerId: 'stripe',
      });

      setMachineError({
        request: { intentId: 'pi_1' },
      });
      await flush();

      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });
  });

  // ============================================================
  // cancelPayment
  // ============================================================
  describe('cancelPayment', () => {
    it('success => ready after machine emits intent', async () => {
      store.cancelPayment({
        request: { intentId: 'pi_1' } as any,
        providerId: 'stripe',
      });

      expect(stateMachineMock.send).toHaveBeenCalledTimes(1);
      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CANCEL',
          providerId: 'stripe',
        }),
      );

      setMachineReady({
        request: { intentId: 'pi_1' },
        intent: { ...intent, status: 'canceled' },
      });
      await flush();

      expect(store.status()).toBe('ready');
      expect(store.intent()?.status).toBe('canceled');
    });

    it('error => status=error', async () => {
      store.cancelPayment({
        request: { intentId: 'pi_1' } as any,
        providerId: 'stripe',
      });

      setMachineError({
        request: { intentId: 'pi_1' },
      });
      await flush();

      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });
  });

  // ============================================================
  // refreshPayment
  // ============================================================
  // ============================================================
  // refreshPayment
  // ============================================================
  describe('refreshPayment', () => {
    const flush = async () => {
      TestBed.tick();
      await Promise.resolve();
      await Promise.resolve();
      TestBed.tick();
    };
    it('refreshPayment -> uses legacy usecase', async () => {
      // fuerza legacy path (machine reject)
      (stateMachineMock.send as any).mockReturnValueOnce(false);

      store.refreshPayment({
        request: { intentId: 'pi_123' },
        providerId: 'stripe',
      });

      await flush();

      expect(getPaymentStatusUseCaseMock.execute).toHaveBeenCalledTimes(1);

      // opcional pero recomendado:
      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REFRESH',
          providerId: 'stripe',
        }),
      );
    });

    it('refreshPayment -> usecase error => status=error', async () => {
      (stateMachineMock.send as any).mockReturnValueOnce(false);

      getPaymentStatusUseCaseMock.execute.mockReturnValueOnce(throwError(() => paymentError));

      store.refreshPayment({
        request: { intentId: 'pi_123' },
        providerId: 'stripe',
      });

      await flush();

      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });
  });

  // ============================================================
  // fallbackExecute$
  // ============================================================
  describe('fallbackExecute$', () => {
    it('triggers startPayment ONLY when orchestrator status is executing', async () => {
      (stateMachineMock.send as any).mockClear();

      fallbackState = { ...fallbackState, status: 'executing' };

      fallbackExecute$.next({ request: req, provider: 'paypal' });
      await flush();

      expect(stateMachineMock.send).toHaveBeenCalledTimes(1);
      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START',
          providerId: 'paypal',
        }),
      );
    });

    it('triggers startPayment ONLY when orchestrator status is auto_executing', async () => {
      (stateMachineMock.send as any).mockClear();

      fallbackState = { ...fallbackState, status: 'auto_executing', isAutoFallback: true };

      fallbackExecute$.next({ request: req, provider: 'paypal' });
      await flush();

      expect(stateMachineMock.send).toHaveBeenCalledTimes(1);
      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START',
          providerId: 'paypal',
        }),
      );
    });

    it('does nothing when orchestrator status is idle', async () => {
      (stateMachineMock.send as any).mockClear();

      fallbackState = { ...fallbackState, status: 'idle' };

      fallbackExecute$.next({ request: req, provider: 'paypal' });
      await flush();

      expect(stateMachineMock.send).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // history
  // ============================================================
  describe('history', () => {
    it('history is capped to HISTORY_MAX_ENTRIES', async () => {
      for (let i = 0; i < HISTORY_MAX_ENTRIES + 5; i++) {
        store.startPayment({ request: req, providerId: 'stripe' });

        setMachineReady({
          intent: { ...intent, id: `pi_${i}` },
        });
        await flush();
      }

      expect(store.history().length).toBe(HISTORY_MAX_ENTRIES);
      expect(store.history()[0].intentId).toBe(`pi_${5}`);
      expect(store.history()[HISTORY_MAX_ENTRIES - 1].intentId).toBe(
        `pi_${HISTORY_MAX_ENTRIES + 4}`,
      );
    });
  });

  // ============================================================
  // Public API
  // ============================================================
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
      setMachineReady();
      await flush();

      expect(store.history().length).toBe(1);

      store.clearHistory();
      expect(store.history()).toEqual([]);
    });

    it('reset clears store + calls orchestrator.reset', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });
      setMachineReady();
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

  // ============================================================
  // executeFallback / cancelFallback
  // ============================================================
  describe('executeFallback', () => {
    it('without pendingEvent uses currentRequest and starts payment with chosen provider', async () => {
      // “armo” currentRequest
      store.startPayment({ request: req, providerId: 'stripe' });
      setMachineReady();
      await flush();

      (stateMachineMock.send as any).mockClear();

      store.executeFallback('paypal');
      await flush();

      expect(stateMachineMock.send).toHaveBeenCalledTimes(1);
      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START',
          providerId: 'paypal',
        }),
      );
    });

    it('with pendingEvent calls respondToFallback accepted true', () => {
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

    it('ignores provider not in alternatives', () => {
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

      store.executeFallback('stripe');

      expect(fallbackOrchestratorMock.respondToFallback).not.toHaveBeenCalled();
    });
  });

  describe('cancelFallback', () => {
    it('with pendingEvent responds accepted=false', () => {
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

    it('without pendingEvent calls orchestrator.reset', () => {
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
