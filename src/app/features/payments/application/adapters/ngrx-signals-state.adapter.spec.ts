import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NgRxSignalsStateAdapter } from './ngrx-signals-state.adapter';
import { PaymentsStore } from '../store/payment.store';
import { INITIAL_FALLBACK_STATE } from '../../domain/models';

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
      reset: vi.fn(),
      clearHistory: vi.fn(),
      executeFallback: vi.fn(),
      cancelFallback: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [NgRxSignalsStateAdapter, { provide: PaymentsStore, useValue: storeMock }],
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
