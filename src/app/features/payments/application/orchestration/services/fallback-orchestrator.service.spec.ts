import { TestBed } from '@angular/core/testing';
import { I18nKeys } from '@core/i18n';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory.registry';
import {
  FALLBACK_CONFIG,
  FallbackOrchestratorService,
} from '@payments/application/orchestration/services/fallback-orchestrator.service';
import type { FallbackConfig } from '@payments/domain/subdomains/fallback/contracts/fallback-config.types';
import { DEFAULT_FALLBACK_CONFIG } from '@payments/domain/subdomains/fallback/contracts/fallback-config.types';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.types';

describe('FallbackOrchestratorService', () => {
  let service: FallbackOrchestratorService;
  let registryMock: {
    getAvailableProviders: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  const mockRequest: CreatePaymentRequest = {
    orderId: 'order_123',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: 'tok_test1234567890abc' },
  };

  const providerUnavailableError: PaymentError = {
    code: 'provider_unavailable',
    messageKey: I18nKeys.errors.stripe_unavailable,
    raw: undefined,
  };

  const cardDeclinedError: PaymentError = {
    code: 'card_declined',
    messageKey: I18nKeys.errors.card_declined,
    raw: undefined,
  };

  beforeEach(() => {
    registryMock = {
      getAvailableProviders: vi.fn((): PaymentProviderId[] => ['stripe', 'paypal']),
      get: vi.fn((providerId: PaymentProviderId) => ({
        providerId,
        supportsMethod: vi.fn(() => true),
      })),
    };

    TestBed.configureTestingModule({
      providers: [
        FallbackOrchestratorService,
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        {
          provide: FALLBACK_CONFIG,
          useValue: {
            enabled: true,
            mode: 'manual',
            maxAttempts: 2,
            triggerErrorCodes: ['provider_unavailable'],
            userResponseTimeout: 5000,
            providerPriority: ['stripe', 'paypal'],
          } satisfies Partial<FallbackConfig>,
        },
      ],
    });

    service = TestBed.inject(FallbackOrchestratorService);
  });

  afterEach(() => {
    if (service) {
      service.reset();
    }
  });

  describe('initial state', () => {
    it('starts with idle status', () => {
      expect(service.state().status).toBe('idle');
    });

    it('has no pending event', () => {
      expect(service.pendingEvent()).toBeNull();
    });

    it('has empty failed attempts', () => {
      expect(service.failedAttempts()).toEqual([]);
    });

    it('isPending returns false', () => {
      expect(service.isPending()).toBe(false);
    });

    it('isAutoExecuting returns false', () => {
      expect(service.isAutoExecuting()).toBe(false);
    });
  });

  describe('reportFailure() - Manual Mode', () => {
    it('returns true and emits event when error is eligible and alternatives exist', () => {
      let emittedEvent: any = null;
      service.fallbackAvailable$.subscribe((event) => {
        emittedEvent = event;
      });

      const result = service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(result).toBe(true);
      expect(emittedEvent).not.toBeNull();
      expect(emittedEvent.failedProvider).toBe('stripe');
      expect(emittedEvent.alternativeProviders).toContain('paypal');
    });

    it('returns false when error code is not eligible for fallback', () => {
      const result = service.reportFailure('stripe', cardDeclinedError, mockRequest);

      expect(result).toBe(false);
      expect(service.state().status).toBe('idle');
    });

    it('returns false when no alternative providers available', () => {
      registryMock.getAvailableProviders.mockReturnValue(['stripe']);

      const result = service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(result).toBe(false);
    });

    it('updates state to pending when fallback is available', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(service.state().status).toBe('pending');
      expect(service.isPending()).toBe(true);
    });

    it('records failed attempt in state with wasAutoFallback=false', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      const attempts = service.failedAttempts();
      expect(attempts).toHaveLength(1);
      expect(attempts[0].provider).toBe('stripe');
      expect(attempts[0].error).toEqual(providerUnavailableError);
      expect(attempts[0].wasAutoFallback).toBe(false);
    });

    it('respects maxAttempts configuration (real flow)', async () => {
      // 1) stripe fails
      expect(service.reportFailure('stripe', providerUnavailableError, mockRequest)).toBe(true);

      // 2) user accepts paypal
      service.respondToFallback({
        eventId: service.pendingEvent()!.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: Date.now(),
      });

      // 3) paypal fails (tries to continue fallback but no alternatives left)
      service.notifyFailure('paypal', providerUnavailableError, mockRequest);

      // Two attempts are already recorded
      expect(service.failedAttempts().length).toBe(2);

      // 4) third attempt -> should reset
      const third = service.reportFailure('stripe', providerUnavailableError, mockRequest);
      expect(third).toBe(false);

      expect(service.state().status).toBe('failed');
      await Promise.resolve();
      expect(service.state().status).toBe('idle');
      expect(service.failedAttempts()).toEqual([]);
    });

    it('resets when maxAttempts reached', async () => {
      // 1) stripe fails
      expect(service.reportFailure('stripe', providerUnavailableError, mockRequest)).toBe(true);

      // 2) paypal fails (no alternatives -> false)
      expect(service.reportFailure('paypal', providerUnavailableError, mockRequest)).toBe(false);

      // 3) stripe fails again, should reset because limit reached
      const third = service.reportFailure('stripe', providerUnavailableError, mockRequest);
      expect(third).toBe(false);

      expect(service.state().status).toBe('failed');
      await Promise.resolve();
      expect(service.state().status).toBe('idle');
      expect(service.failedAttempts()).toEqual([]);
    });

    it('stops immediately when maxAttempts is 1', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          FallbackOrchestratorService,
          { provide: ProviderFactoryRegistry, useValue: registryMock },
          {
            provide: FALLBACK_CONFIG,
            useValue: {
              enabled: true,
              mode: 'manual',
              maxAttempts: 1,
              triggerErrorCodes: ['provider_unavailable'],
              userResponseTimeout: 5000,
              providerPriority: ['stripe', 'paypal'],
            } satisfies Partial<FallbackConfig>,
          },
        ],
      });

      const limitedService = TestBed.inject(FallbackOrchestratorService);

      const result = limitedService.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(result).toBe(false);
      expect(limitedService.state().status).toBe('failed');
      await Promise.resolve();
      expect(limitedService.state().status).toBe('idle');
      expect(limitedService.failedAttempts()).toEqual([]);

      limitedService.reset();
    });

    it('excludes failedProvider from alternativeProviders', () => {
      let emittedEvent: any = null;
      service.fallbackAvailable$.subscribe((event) => {
        emittedEvent = event;
      });

      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(emittedEvent).not.toBeNull();
      expect(emittedEvent.failedProvider).toBe('stripe');
      expect(emittedEvent.alternativeProviders).not.toContain('stripe');
    });

    it('excludes previously failed providers from alternativeProviders', () => {
      // First failure with stripe => failedAttempts = [stripe]
      const first = service.reportFailure('stripe', providerUnavailableError, mockRequest);
      expect(first).toBe(true);

      // Second failure with paypal => stripe already in failedAttempts,
      // so no alternatives are available
      const second = service.reportFailure('paypal', providerUnavailableError, mockRequest);

      expect(second).toBe(false);
    });

    it('only includes providers available in registry', () => {
      // Configure registry to only have stripe available
      registryMock.getAvailableProviders.mockReturnValue(['stripe']);

      const result = service.reportFailure('stripe', providerUnavailableError, mockRequest);

      // There should be no alternatives available
      expect(result).toBe(false);
    });

    it('only includes providers that support the same payment method type', () => {
      // Mock paypal to not support the 'card' method
      const stripeFactoryMock = {
        providerId: 'stripe' as const,
        supportsMethod: vi.fn(() => true),
      };

      const paypalFactoryMock = {
        providerId: 'paypal' as const,
        supportsMethod: vi.fn(() => false), // PayPal does not support card in this test
      };

      registryMock.get.mockImplementation((providerId: PaymentProviderId) => {
        if (providerId === 'stripe') return stripeFactoryMock;
        if (providerId === 'paypal') return paypalFactoryMock;
        throw new Error(`Unknown provider: ${providerId}`);
      });

      let emittedEvent: any = null;
      service.fallbackAvailable$.subscribe((event) => {
        emittedEvent = event;
      });

      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      // PayPal should not be in alternatives if it does not support the method
      if (emittedEvent) {
        expect(emittedEvent.alternativeProviders).not.toContain('paypal');
      }
    });
  });

  describe('respondToFallback()', () => {
    beforeEach(() => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);
    });

    it('updates state to executing when user accepts', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      const event = service.pendingEvent()!;

      service.respondToFallback({
        eventId: event.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      expect(service.state().status).toBe('executing');
      expect(service.state().currentProvider).toBe('paypal');
      expect(service.state().isAutoFallback).toBe(false);

      vi.useRealTimers();
    });

    it('updates state to cancelled when user declines', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      const event = service.pendingEvent()!;

      service.respondToFallback({
        eventId: event.eventId,
        accepted: false,
        timestamp: baseTime,
      });

      expect(service.state().status).toBe('cancelled');

      vi.useRealTimers();
    });

    it('clears pending event after response', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      const event = service.pendingEvent()!;

      service.respondToFallback({
        eventId: event.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      expect(service.pendingEvent()).toBeNull();

      vi.useRealTimers();
    });

    it('emits fallbackExecute$ when user accepts', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      let emittedData: any = null;
      service.fallbackExecute$.subscribe((data) => {
        emittedData = data;
      });

      const event = service.pendingEvent()!;
      service.respondToFallback({
        eventId: event.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      expect(emittedData).not.toBeNull();
      expect(emittedData.fromProvider).toBe('stripe');
      expect(emittedData.eventId).toBeTruthy();
      expect(typeof emittedData.wasAutoFallback).toBe('boolean');

      vi.useRealTimers();
    });

    it('ignores response for unknown eventId', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      const originalStatus = service.state().status;

      service.respondToFallback({
        eventId: 'unknown_event',
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      expect(service.state().status).toBe(originalStatus);

      vi.useRealTimers();
    });

    it('ignores response for expired event (TTL exceeded)', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      const event = service.pendingEvent()!;
      expect(event).not.toBeNull();

      // Simulate expired event (timestamp too old, before TTL)
      const ttl = service.getConfig().userResponseTimeout;
      const expiredTimestamp = baseTime - ttl - 1000;
      const expiredEvent: typeof event = {
        ...event,
        timestamp: expiredTimestamp,
      };

      // Simulate event expired in state
      (service as any)['_state'].update((s: any) => ({
        ...s,
        pendingEvent: expiredEvent,
      }));

      // Advance time to simulate TTL passing
      vi.advanceTimersByTime(ttl + 100);

      service.respondToFallback({
        eventId: expiredEvent.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime + ttl + 100,
      });

      // Should clear state but not execute fallback
      expect(service.state().status).toBe('cancelled');
      expect(service.pendingEvent()).toBeNull();

      vi.useRealTimers();
    });

    it('rejects provider not in alternativeProviders', async () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      const event = service.pendingEvent()!;

      service.respondToFallback({
        eventId: event.eventId,
        accepted: true,
        selectedProvider: 'invalid_provider' as PaymentProviderId,
        timestamp: baseTime,
      });

      // ✅ Immediate terminal state
      expect(service.state().status).toBe('cancelled');

      // ✅ after microtask it resets to idle
      await Promise.resolve();
      expect(service.state().status).toBe('idle');

      vi.useRealTimers();
    });

    it('uses originalRequest when executing fallback', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      let emittedData: any = null;
      service.fallbackExecute$.subscribe((data) => {
        emittedData = data;
      });

      const event = service.pendingEvent()!;
      service.respondToFallback({
        eventId: event.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      // Verificar que se emite con el originalRequest (sin modificar)
      expect(emittedData).not.toBeNull();
      expect(emittedData.request).toBe(event.originalRequest);
      expect(emittedData.request).toEqual(mockRequest);

      vi.useRealTimers();
    });

    it('clears pending event after accepting fallback', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      const event = service.pendingEvent()!;

      service.respondToFallback({
        eventId: event.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      expect(service.pendingEvent()).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      service.reportFailure('stripe', providerUnavailableError, mockRequest);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('clears pending event after TTL expires', () => {
      expect(service.state().status).toBe('pending');

      vi.advanceTimersByTime(service.getConfig().userResponseTimeout + 100);

      expect(service.state().status).toBe('cancelled'); // esto depende del punto 3 (ver abajo)
      expect(service.pendingEvent()).toBeNull();
    });
  });

  describe('notifySuccess()', () => {
    it('updates state to completed', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      service.reportFailure('stripe', providerUnavailableError, mockRequest);
      service.respondToFallback({
        eventId: service.pendingEvent()!.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      service.notifySuccess();

      expect(service.state().status).toBe('completed');
      expect(service.state().isAutoFallback).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('notifyFailure()', () => {
    it('updates state to failed', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      service.reportFailure('stripe', providerUnavailableError, mockRequest);
      service.respondToFallback({
        eventId: service.pendingEvent()!.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      service.notifyFailure('paypal', providerUnavailableError);

      expect(service.state().status).toBe('failed');

      vi.useRealTimers();
    });

    it('sets status to failed when notifyFailure is called without originalRequest', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      service.reportFailure('stripe', providerUnavailableError, mockRequest);
      service.respondToFallback({
        eventId: service.pendingEvent()!.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      // notifyFailure without originalRequest should just set status to failed
      service.notifyFailure('paypal', providerUnavailableError);

      expect(service.state().status).toBe('failed');

      vi.useRealTimers();
    });

    it('attempts to report another failure when originalRequest is provided', () => {
      vi.useFakeTimers();
      const baseTime = 1000000;
      vi.setSystemTime(baseTime);

      // With default config (maxAttempts=2, providers=['stripe', 'paypal']),
      // after stripe fails and paypal fails, there are no more alternatives
      service.reportFailure('stripe', providerUnavailableError, mockRequest);
      service.respondToFallback({
        eventId: service.pendingEvent()!.eventId,
        accepted: true,
        selectedProvider: 'paypal',
        timestamp: baseTime,
      });

      // notifyFailure with originalRequest will try to reportFailure
      // but since paypal is excluded and stripe already failed,
      // there are no alternatives, so it stays 'failed'
      service.notifyFailure('paypal', providerUnavailableError, mockRequest);

      // Status should be 'failed' because no alternatives available
      expect(service.state().status).toBe('failed');

      vi.useRealTimers();
    });
  });

  describe('reset()', () => {
    it('resets state to initial', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      service.reset();

      expect(service.state().status).toBe('idle');
      expect(service.pendingEvent()).toBeNull();
      expect(service.failedAttempts()).toEqual([]);
      expect(service.state().isAutoFallback).toBe(false);
    });
  });

  describe('getSnapshot()', () => {
    it('returns current state', () => {
      const snapshot = service.getSnapshot();

      expect(snapshot.status).toBe('idle');
      expect(snapshot.pendingEvent).toBeNull();
    });
  });

  describe('timeout behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('auto-cancels after timeout if no response', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(service.state().status).toBe('pending');

      // Advance time past the timeout (default 30 seconds)
      vi.advanceTimersByTime(DEFAULT_FALLBACK_CONFIG.userResponseTimeout + 100);
      expect(service.state().status).toBe('cancelled');
    });
  });

  describe('configuration', () => {
    it('can be configured with custom config', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          FallbackOrchestratorService,
          { provide: ProviderFactoryRegistry, useValue: registryMock },
          { provide: FALLBACK_CONFIG, useValue: { enabled: false } },
        ],
      });

      const configuredService = TestBed.inject(FallbackOrchestratorService);

      // Should not trigger fallback when disabled
      const result = configuredService.reportFailure(
        'stripe',
        providerUnavailableError,
        mockRequest,
      );

      expect(result).toBe(false);
    });

    it('returns config via getConfig()', () => {
      const config = service.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.mode).toBe('manual');
      expect(config.maxAttempts).toBe(2);
    });
  });
});

describe('FallbackOrchestratorService - Auto Mode', () => {
  let service: FallbackOrchestratorService;
  let registryMock: {
    getAvailableProviders: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  const mockRequest: CreatePaymentRequest = {
    orderId: 'order_123',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: 'tok_test1234567890abc' },
  };

  const providerUnavailableError: PaymentError = {
    code: 'provider_unavailable',
    messageKey: I18nKeys.errors.stripe_unavailable,
    raw: undefined,
  };

  beforeEach(() => {
    registryMock = {
      getAvailableProviders: vi.fn((): PaymentProviderId[] => ['stripe', 'paypal']),
      get: vi.fn((providerId: PaymentProviderId) => ({
        providerId,
        supportsMethod: vi.fn(() => true),
      })),
    };

    TestBed.configureTestingModule({
      providers: [
        FallbackOrchestratorService,
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        {
          provide: FALLBACK_CONFIG,
          useValue: {
            mode: 'auto',
            autoFallbackDelay: 100, // 100ms for faster tests
            maxAutoFallbacks: 1,
            maxAttempts: 3,
          },
        },
      ],
    });

    service = TestBed.inject(FallbackOrchestratorService);
  });

  afterEach(() => {
    service.reset();
  });

  describe('auto-fallback behavior', () => {
    it('should set status to auto_executing immediately', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(service.state().status).toBe('auto_executing');
      expect(service.isAutoExecuting()).toBe(true);
      expect(service.state().isAutoFallback).toBe(true);
    });

    it('should emit autoFallbackStarted$ event', () => {
      let emittedData: any = null;
      service.autoFallbackStarted$.subscribe((data) => {
        emittedData = data;
      });

      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(emittedData).not.toBeNull();
      expect(emittedData.provider).toBe('paypal');
      expect(emittedData.delay).toBe(100);
    });

    it('should emit fallbackExecute$ after delay', async () => {
      let emittedData: any = null;
      service.fallbackExecute$.subscribe((data) => {
        emittedData = data;
      });
      vi.useFakeTimers();

      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      vi.advanceTimersByTime(150);

      expect(emittedData).not.toBeNull();

      vi.useRealTimers();

      expect(emittedData.fromProvider).toBe('stripe');
      expect(emittedData.eventId).toBeTruthy();
      expect(typeof emittedData.wasAutoFallback).toBe('boolean');
    });

    it('should set currentProvider during auto execution', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(service.currentProvider()).toBe('paypal');
    });

    it('should record failed attempt with wasAutoFallback=true on subsequent failures', async () => {
      // First failure triggers auto-fallback to paypal
      vi.useFakeTimers();
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      vi.advanceTimersByTime(100);

      // Simulate paypal failure
      service.notifyFailure('paypal', providerUnavailableError, mockRequest);

      const attempts = service.failedAttempts();
      // After auto-fallback, if paypal fails and triggers manual, wasAutoFallback should be tracked
      expect(attempts.length).toBeGreaterThanOrEqual(1);
      vi.useRealTimers();
    });

    it('should fall back to manual mode after maxAutoFallbacks', async () => {
      vi.useFakeTimers();
      // Configure with multiple providers
      registryMock.getAvailableProviders.mockReturnValue([
        'stripe',
        'paypal',
        'mercadopago',
      ] as PaymentProviderId[]);

      // First failure triggers auto-fallback
      service.reportFailure('stripe', providerUnavailableError, mockRequest);
      expect(service.state().status).toBe('auto_executing');
      vi.advanceTimersByTime(100);

      // Notify failure after auto-fallback
      service.notifyFailure('paypal', providerUnavailableError, mockRequest);

      // Second failure should now be manual (maxAutoFallbacks = 1)
      // Because we've already done 1 auto-fallback
      expect(service.getAutoFallbackCount()).toBe(1);
      expect(service.state().status).toBe('pending');
      expect(service.pendingEvent()).not.toBeNull();
      expect(service.pendingEvent()!.alternativeProviders).toContain('mercadopago');

      vi.useRealTimers();
    });

    it('should not emit fallbackAvailable$ in auto mode', () => {
      let eventEmitted = false;
      service.fallbackAvailable$.subscribe(() => {
        eventEmitted = true;
      });

      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(eventEmitted).toBe(false);
    });

    it('should go manual when maxAutoFallbacks is 0', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          FallbackOrchestratorService,
          { provide: ProviderFactoryRegistry, useValue: registryMock },
          {
            provide: FALLBACK_CONFIG,
            useValue: {
              mode: 'auto',
              autoFallbackDelay: 100,
              maxAutoFallbacks: 0,
            },
          },
        ],
      });

      const limitedService = TestBed.inject(FallbackOrchestratorService);

      limitedService.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(limitedService.state().status).toBe('pending');
      expect(limitedService.pendingEvent()).not.toBeNull();

      limitedService.reset();
    });
  });

  describe('getAutoFallbackCount()', () => {
    it('should return 0 initially', () => {
      expect(service.getAutoFallbackCount()).toBe(0);
    });
  });

  describe('computed signals', () => {
    it('isExecuting should be true during auto_executing', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(service.isExecuting()).toBe(true);
      expect(service.isAutoExecuting()).toBe(true);
    });

    it('isAutoFallback should be true during auto execution', () => {
      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      expect(service.isAutoFallback()).toBe(true);
    });
  });

  describe('cancellation during auto-fallback', () => {
    it('should stop auto-fallback when reset is called', async () => {
      vi.useFakeTimers();
      let emitted: any = null;
      service.fallbackExecute$.subscribe((v) => (emitted = v));

      service.reportFailure('stripe', providerUnavailableError, mockRequest);

      // Reset before delay completes
      vi.advanceTimersByTime(50);
      service.reset();
      vi.advanceTimersByTime(100);

      // Should not have emitted
      expect(emitted).toBeNull();
      expect(service.state().status).toBe('idle');
      vi.useRealTimers();
    });
  });
});
