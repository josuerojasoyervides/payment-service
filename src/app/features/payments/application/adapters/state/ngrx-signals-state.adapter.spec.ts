import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExternalEventAdapter } from '@payments/application/adapters/events/external/external-event.adapter';
import { NgRxSignalsStateAdapter } from '@payments/application/adapters/state/ngrx-signals-state.adapter';
import { ProviderDescriptorRegistry } from '@payments/application/orchestration/registry/provider-descriptor/provider-descriptor.registry';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { PaymentsStore } from '@payments/application/orchestration/store/payment-store';
import { INITIAL_FALLBACK_STATE } from '@payments/domain/subdomains/fallback/entities/fallback-state.types';

describe('NgRxSignalsStateAdapter', () => {
  let adapter: NgRxSignalsStateAdapter;
  let storeMock: any;

  beforeEach(() => {
    // Create mock signals for the store
    storeMock = {
      // State signals
      status: signal('idle'),
      intent: signal(null),
      error: signal(null),
      selectedProvider: signal(null),
      currentRequest: signal(null),
      fallback: signal(INITIAL_FALLBACK_STATE),
      history: signal([]),

      // Computed signals
      isLoading: signal(false),
      isReady: signal(false),
      hasError: signal(false),
      currentIntent: signal(null),
      currentError: signal(null),
      hasPendingFallback: signal(false),
      pendingFallbackEvent: signal(null),
      historyCount: signal(0),
      lastHistoryEntry: signal(null),
      debugSummary: signal({
        status: 'idle',
        intentId: null,
        provider: null,
        fallbackStatus: 'idle',
        historyCount: 0,
      }),

      // Methods
      startPayment: vi.fn(),
      confirmPayment: vi.fn(),
      cancelPayment: vi.fn(),
      refreshPayment: vi.fn(),
      selectProvider: vi.fn(),
      clearError: vi.fn(),
      setError: vi.fn(),
      reset: vi.fn(),
      clearHistory: vi.fn(),
      executeFallback: vi.fn(),
      cancelFallback: vi.fn(),
    };

    const registryMock = {
      getAvailableProviders: () => [] as const,
      get: () => ({
        getSupportedMethods: () => [] as const,
        getFieldRequirements: () => null,
        createRequestBuilder: () => ({
          forOrder: () => ({
            withAmount: () => ({ withOptions: () => ({ build: () => ({}) as any }) }),
          }),
        }),
      }),
    };

    const descriptorRegistryMock = {
      getProviderDescriptors: () => [] as const,
      getProviderDescriptor: () => null,
    };

    const externalEventAdapterMock = {
      redirectReturned: vi.fn(),
      externalStatusUpdated: vi.fn(),
      webhookReceived: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        NgRxSignalsStateAdapter,
        { provide: PaymentsStore, useValue: storeMock },
        { provide: ProviderFactoryRegistry, useValue: registryMock },
        { provide: ProviderDescriptorRegistry, useValue: descriptorRegistryMock },
        { provide: ExternalEventAdapter, useValue: externalEventAdapterMock },
      ],
    });

    adapter = TestBed.inject(NgRxSignalsStateAdapter);
  });

  describe('state signals delegation', () => {
    it('exposes isLoading from store', () => {
      expect(adapter.isLoading()).toBe(false);
      storeMock.isLoading.set(true);
      expect(adapter.isLoading()).toBe(true);
    });

    it('exposes isReady from store', () => {
      expect(adapter.isReady()).toBe(false);
      storeMock.isReady.set(true);
      expect(adapter.isReady()).toBe(true);
    });

    it('exposes hasError from store', () => {
      expect(adapter.hasError()).toBe(false);
      storeMock.hasError.set(true);
      expect(adapter.hasError()).toBe(true);
    });

    it('exposes intent from store', () => {
      const mockIntent = {
        id: 'pi_1',
        provider: 'stripe',
        status: 'succeeded',
        amount: 100,
        currency: 'MXN',
      };
      expect(adapter.intent()).toBeNull();
      storeMock.currentIntent.set(mockIntent);
      expect(adapter.intent()).toEqual(mockIntent);
    });

    it('exposes error from store', () => {
      const mockError = { code: 'card_declined', message: 'Card declined' };
      expect(adapter.error()).toBeNull();
      storeMock.currentError.set(mockError);
      expect(adapter.error()).toEqual(mockError);
    });

    it('exposes selectedProvider from store', () => {
      expect(adapter.selectedProvider()).toBeNull();
      storeMock.selectedProvider.set('stripe');
      expect(adapter.selectedProvider()).toBe('stripe');
    });
  });

  describe('fallback signals delegation', () => {
    it('exposes hasPendingFallback from store', () => {
      expect(adapter.hasPendingFallback()).toBe(false);
      storeMock.hasPendingFallback.set(true);
      expect(adapter.hasPendingFallback()).toBe(true);
    });

    it('exposes pendingFallbackEvent from store', () => {
      const mockEvent = {
        eventId: 'fb_1',
        failedProvider: 'stripe',
        alternativeProviders: ['paypal'],
      };
      expect(adapter.pendingFallbackEvent()).toBeNull();
      storeMock.pendingFallbackEvent.set(mockEvent);
      expect(adapter.pendingFallbackEvent()).toEqual(mockEvent);
    });

    it('exposes fallbackState computed from store.fallback', () => {
      expect(adapter.fallbackState()).toEqual(INITIAL_FALLBACK_STATE);
    });
  });

  describe('history signals delegation', () => {
    it('exposes historyCount from store', () => {
      expect(adapter.historyCount()).toBe(0);
      storeMock.historyCount.set(5);
      expect(adapter.historyCount()).toBe(5);
    });

    it('exposes lastHistoryEntry from store', () => {
      const mockEntry = {
        intentId: 'pi_1',
        provider: 'stripe',
        status: 'succeeded',
        amount: 100,
        currency: 'MXN',
        timestamp: Date.now(),
      };
      expect(adapter.lastHistoryEntry()).toBeNull();
      storeMock.lastHistoryEntry.set(mockEntry);
      expect(adapter.lastHistoryEntry()).toEqual(mockEntry);
    });

    it('exposes history computed from store.history', () => {
      expect(adapter.history()).toEqual([]);
    });
  });

  describe('getSnapshot()', () => {
    it('returns current state as readonly object', () => {
      const snapshot = adapter.getSnapshot();
      expect(snapshot.status).toBe('idle');
      expect(snapshot.intent).toBeNull();
      expect(snapshot.error).toBeNull();
    });
  });

  describe('payment actions delegation', () => {
    it('delegates startPayment to store', () => {
      const request = {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN' as const,
        method: { type: 'card' as const },
      };
      adapter.startPayment(request, 'stripe');
      expect(storeMock.startPayment).toHaveBeenCalledWith({
        request,
        providerId: 'stripe',
        context: undefined,
      });
    });

    it('delegates startPayment with context to store', () => {
      const request = {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN' as const,
        method: { type: 'card' as const },
      };
      const context = { returnUrl: 'https://return.com', isTest: true };
      adapter.startPayment(request, 'stripe', context);
      expect(storeMock.startPayment).toHaveBeenCalledWith({
        request,
        providerId: 'stripe',
        context,
      });
    });

    it('delegates confirmPayment to store', () => {
      const request = { intentId: 'pi_1' };
      adapter.confirmPayment(request, 'stripe');
      expect(storeMock.confirmPayment).toHaveBeenCalledWith({ request, providerId: 'stripe' });
    });

    it('delegates cancelPayment to store', () => {
      const request = { intentId: 'pi_1' };
      adapter.cancelPayment(request, 'stripe');
      expect(storeMock.cancelPayment).toHaveBeenCalledWith({ request, providerId: 'stripe' });
    });

    it('delegates refreshPayment to store', () => {
      const request = { intentId: 'pi_1' };
      adapter.refreshPayment(request, 'stripe');
      expect(storeMock.refreshPayment).toHaveBeenCalledWith({ request, providerId: 'stripe' });
    });
  });

  describe('providerId resolution (confirmPayment, cancelPayment, refreshPayment)', () => {
    const request = { intentId: 'pi_1' as const };

    it('uses intent.provider when providerId is omitted', () => {
      storeMock.currentIntent.set({
        id: 'pi_1',
        provider: 'stripe',
        status: 'succeeded',
        amount: 100,
        currency: 'MXN',
        clientSecret: 'secret',
      });
      storeMock.selectedProvider.set(null);

      adapter.confirmPayment(request);
      expect(storeMock.confirmPayment).toHaveBeenCalledWith({
        request,
        providerId: 'stripe',
      });
      expect(storeMock.setError).not.toHaveBeenCalled();
    });

    it('uses selectedProvider when providerId is omitted and no intent', () => {
      storeMock.currentIntent.set(null);
      storeMock.selectedProvider.set('paypal');

      adapter.cancelPayment(request);
      expect(storeMock.cancelPayment).toHaveBeenCalledWith({
        request,
        providerId: 'paypal',
      });
      expect(storeMock.setError).not.toHaveBeenCalled();
    });

    it('sets error and does not call store when providerId cannot be resolved', () => {
      storeMock.currentIntent.set(null);
      storeMock.selectedProvider.set(null);

      adapter.refreshPayment(request);
      expect(storeMock.refreshPayment).not.toHaveBeenCalled();
      expect(storeMock.setError).toHaveBeenCalledWith({
        code: 'missing_provider',
        messageKey: 'errors.missing_provider',
      });
    });
  });

  describe('UI actions delegation', () => {
    it('delegates selectProvider to store', () => {
      adapter.selectProvider('paypal');
      expect(storeMock.selectProvider).toHaveBeenCalledWith('paypal');
    });

    it('delegates clearError to store', () => {
      adapter.clearError();
      expect(storeMock.clearError).toHaveBeenCalled();
    });

    it('delegates reset to store', () => {
      adapter.reset();
      expect(storeMock.reset).toHaveBeenCalled();
    });

    it('delegates clearHistory to store', () => {
      adapter.clearHistory();
      expect(storeMock.clearHistory).toHaveBeenCalled();
    });
  });

  describe('fallback actions delegation', () => {
    it('delegates executeFallback to store', () => {
      adapter.executeFallback('paypal');
      expect(storeMock.executeFallback).toHaveBeenCalledWith('paypal');
    });

    it('delegates cancelFallback to store', () => {
      adapter.cancelFallback();
      expect(storeMock.cancelFallback).toHaveBeenCalled();
    });
  });

  describe('debugSummary', () => {
    it('exposes debugSummary from store', () => {
      const summary = adapter.debugSummary();
      expect(summary.status).toBe('idle');
      expect(summary.historyCount).toBe(0);
    });
  });
});
