import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import { patchState } from '@ngrx/signals';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { FallbackOrchestratorService } from '@payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import { HISTORY_MAX_ENTRIES } from '@payments/application/orchestration/store/history/payment-store.history.types';
import { PaymentsStore } from '@payments/application/orchestration/store/payment-store';
import { initialPaymentsState } from '@payments/application/orchestration/store/types/payment-store-state';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { Subject } from 'rxjs';

describe('PaymentsStore', () => {
  let store: InstanceType<typeof PaymentsStore>;

  const flush = async () => {
    TestBed.tick();
    // 1 vuelta de microtasks
    /* await Promise.resolve(); */
    // 2 passes in case of chained effects
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
    messageKey: 'errors.provider_error',
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
  // Machine snapshot mock (source of truth)
  // -------------------
  const buildSnapshot = (params: {
    value: string;
    context?: Partial<any>;
    lastSentEvent?: any;
    tags?: string[];
  }) => {
    const context = {
      providerId: null,
      request: null,
      flowContext: null,
      intent: null,
      error: null,
      ...(params.context ?? {}),
    };
    const derivedTags =
      params.tags ??
      (params.value === 'starting' ||
      params.value === 'confirming' ||
      params.value === 'cancelling' ||
      params.value === 'fetchingStatus' ||
      params.value === 'fetchingStatusInvoke'
        ? ['loading']
        : params.value === 'failed'
          ? ['error']
          : params.value === 'done' ||
              params.value === 'requiresAction' ||
              params.value === 'polling' ||
              params.value === 'afterStatus'
            ? ['ready']
            : params.value === 'idle'
              ? ['idle']
              : []);

    return {
      value: params.value,
      context,
      lastSentEvent: params.lastSentEvent ?? null,
      tags: new Set(derivedTags),
      hasTag: (tag: string) => derivedTags.includes(tag),
    };
  };

  const machineSnapshot = signal<any>(
    buildSnapshot({
      value: 'idle',
    }),
  );

  const resetMachine = () => {
    machineSnapshot.set(
      buildSnapshot({
        value: 'idle',
      }),
    );
  };

  const setMachineLoading = (overrides?: Partial<any>, value = 'starting') => {
    machineSnapshot.set(
      buildSnapshot({
        value,
        context: {
          providerId: 'stripe',
          request: req,
          flowContext: null,
          intent: null,
          error: null,
          ...overrides,
        },
        lastSentEvent: { type: 'START', providerId: 'stripe', request: req },
      }),
    );
  };

  const setMachineReady = (overrides?: Partial<any>) => {
    machineSnapshot.set(
      buildSnapshot({
        value: 'done',
        context: {
          providerId: 'stripe',
          request: req,
          flowContext: null,
          intent,
          error: null,
          ...overrides,
        },
        lastSentEvent: { type: 'START', providerId: 'stripe', request: req },
      }),
    );
  };

  const setMachineError = (overrides?: Partial<any>) => {
    machineSnapshot.set(
      buildSnapshot({
        value: 'failed',
        context: {
          providerId: 'stripe',
          request: req,
          flowContext: null,
          intent: null,
          error: paymentError,
          ...overrides,
        },
        lastSentEvent: { type: 'START', providerId: 'stripe', request: req },
      }),
    );
  };

  const setMachineFallbackCandidate = (overrides?: Partial<any>) => {
    machineSnapshot.set(
      buildSnapshot({
        value: 'fallbackCandidate',
        context: {
          providerId: 'stripe',
          request: req,
          flowContext: null,
          intent: null,
          error: null,
          fallback: {
            eligible: true,
            mode: 'manual',
            failedProviderId: 'stripe',
            request: req,
            selectedProviderId: null,
          },
          ...overrides,
        },
        lastSentEvent: {
          type: 'FALLBACK_REQUESTED',
          failedProviderId: 'stripe',
          request: req,
        },
        tags: ['ready', 'fallback'],
      }),
    );
  };

  const stateMachineMock: Partial<PaymentFlowActorService> = {
    snapshot: machineSnapshot as any,
    send: vi.fn(() => true),
    sendSystem: vi.fn(),
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

      setMachineLoading();
      await flush();

      expect(store.status()).toBe('loading');
      expect(store.error()).toBeNull();
      expect(store.selectedProvider()).toBe('stripe');

      // 2) the machine produces an intent
      setMachineReady();
      await flush();

      expect(store.status()).toBe('ready');
      expect(store.intent()?.id).toBe('pi_1');
      expect(store.history().length).toBe(1);
    });

    it('machine error WITHOUT fallback => status=error + error', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });
      setMachineLoading();
      await flush();
      expect(store.status()).toBe('loading');

      setMachineError();
      await flush();

      expect(store.status()).toBe('error');
      expect(store.error()).toEqual(paymentError);
    });

    it('fallback candidate from machine => silent failure (no UI error)', async () => {
      store.startPayment({ request: req, providerId: 'stripe' });
      setMachineLoading();
      await flush();
      expect(store.status()).toBe('loading');

      setMachineFallbackCandidate();
      await flush();

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

      // and if the machine responds ok
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
    const powerFlush = async () => {
      TestBed.tick();
      await Promise.resolve();
      TestBed.tick();
    };

    it('refreshPayment -> uses XState when accepted', async () => {
      store.refreshPayment({
        request: { intentId: 'pi_123' },
        providerId: 'stripe',
      });

      setMachineLoading(
        {
          providerId: 'stripe',
          request: null,
          intent: null,
          intentId: 'pi_123',
        },
        'fetchingStatus',
      );
      await powerFlush();

      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REFRESH',
          providerId: 'stripe',
          intentId: 'pi_123',
        }),
      );

      expect(store.status()).toBe('loading');

      machineSnapshot.set(
        buildSnapshot({
          value: 'done',
          context: {
            providerId: 'stripe',
            request: null,
            flowContext: null,
            intent: { ...intent, id: 'pi_123', status: 'processing' },
            error: null,
          },
          lastSentEvent: { type: 'REFRESH', providerId: 'stripe', intentId: 'pi_123' },
        }),
      );

      await powerFlush();

      expect(store.status()).toBe('ready');
      expect(store.intent()?.id).toBe('pi_123');
    });

    it('refreshPayment -> ignores when machine rejects', async () => {
      (stateMachineMock.send as any).mockReturnValueOnce(false);

      store.refreshPayment({
        request: { intentId: 'pi_123' },
        providerId: 'stripe',
      });

      await powerFlush();

      expect(stateMachineMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REFRESH',
          providerId: 'stripe',
          intentId: 'pi_123',
        }),
      );

      expect(store.status()).not.toBe('loading');
    });
  });

  // ============================================================
  // fallbackExecute$
  // ============================================================
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
      setMachineLoading();
      await flush();
      setMachineReady();
      await flush();

      (stateMachineMock.sendSystem as any).mockClear();

      store.executeFallback('paypal');
      await flush();

      expect(stateMachineMock.sendSystem).toHaveBeenCalledTimes(1);
      expect(stateMachineMock.sendSystem).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'FALLBACK_EXECUTE',
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
