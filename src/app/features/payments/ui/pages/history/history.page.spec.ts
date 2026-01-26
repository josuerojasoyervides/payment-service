import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { PaymentHistoryFacade } from '@payments/application/api/facades/payment-history.facade';
import { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';

import { HistoryComponent } from './history.page';

describe('HistoryComponent', () => {
  let component: HistoryComponent;
  let fixture: ComponentFixture<HistoryComponent>;
  let mockHistoryFacade: any;

  const mockHistoryEntries: PaymentHistoryEntry[] = [
    {
      intentId: 'pi_test_1',
      provider: 'stripe',
      status: 'succeeded',
      amount: 100,
      currency: 'MXN',
      timestamp: Date.now(),
    },
    {
      intentId: 'pi_test_2',
      provider: 'paypal',
      status: 'requires_confirmation',
      amount: 200,
      currency: 'MXN',
      timestamp: Date.now() - 1000,
    },
    {
      intentId: 'pi_test_3',
      provider: 'stripe',
      status: 'canceled',
      amount: 300,
      currency: 'MXN',
      timestamp: Date.now() - 2000,
    },
  ];

  beforeEach(async () => {
    // History facade mock
    mockHistoryFacade = {
      history: signal<PaymentHistoryEntry[]>([]),
      historyCount: signal(0),
      isLoading: signal(false),
      confirmPayment: vi.fn(),
      cancelPayment: vi.fn(),
      refreshPayment: vi.fn(),
      clearHistory: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [HistoryComponent, RouterLink],
      providers: [
        { provide: PaymentHistoryFacade, useValue: mockHistoryFacade },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should expose history from payment state', () => {
      mockHistoryFacade.history.set(mockHistoryEntries);
      fixture.detectChanges();
      expect(component.history()).toEqual(mockHistoryEntries);
    });

    it('should expose historyCount from payment state', () => {
      mockHistoryFacade.historyCount.set(3);
      fixture.detectChanges();
      expect(component.historyCount()).toBe(3);
    });

    it('should expose isLoading from payment state', () => {
      mockHistoryFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });
  });

  describe('isActionRequired', () => {
    it('should return true for requires_payment_method', () => {
      expect(component.isActionRequired('requires_payment_method')).toBe(true);
    });

    it('should return true for requires_confirmation', () => {
      expect(component.isActionRequired('requires_confirmation')).toBe(true);
    });

    it('should return true for requires_action', () => {
      expect(component.isActionRequired('requires_action')).toBe(true);
    });

    it('should return false for succeeded', () => {
      expect(component.isActionRequired('succeeded')).toBe(false);
    });

    it('should return false for canceled', () => {
      expect(component.isActionRequired('canceled')).toBe(false);
    });

    it('should return false for processing', () => {
      expect(component.isActionRequired('processing')).toBe(false);
    });
  });

  describe('entryToIntent', () => {
    it('should convert entry to PaymentIntent correctly', () => {
      const entry = mockHistoryEntries[0];
      const intent = component.entryToIntent(entry);

      expect(intent.id).toBe(entry.intentId);
      expect(intent.provider).toBe(entry.provider);
      expect(intent.status).toBe(entry.status);
      expect(intent.amount).toBe(entry.amount);
      expect(intent.currency).toBe(entry.currency);
    });

    it('should handle different statuses', () => {
      const entry = mockHistoryEntries[1];
      const intent = component.entryToIntent(entry);
      expect(intent.status).toBe('requires_confirmation');
    });

    it('should handle canceled entries', () => {
      const entry = mockHistoryEntries[2];
      const intent = component.entryToIntent(entry);
      expect(intent.status).toBe('canceled');
    });
  });

  describe('Payment actions', () => {
    it('should confirm payment', () => {
      component.confirmPayment('pi_test_1', 'stripe');
      expect(mockHistoryFacade.confirmPayment).toHaveBeenCalledWith('pi_test_1', 'stripe');
    });

    it('should cancel payment', () => {
      component.cancelPayment('pi_test_1', 'stripe');
      expect(mockHistoryFacade.cancelPayment).toHaveBeenCalledWith('pi_test_1', 'stripe');
    });

    it('should refresh payment', () => {
      component.refreshPayment('pi_test_1', 'stripe');
      expect(mockHistoryFacade.refreshPayment).toHaveBeenCalledWith('pi_test_1', 'stripe');
    });

    it('should work with different providers', () => {
      component.confirmPayment('pi_test_2', 'paypal');
      expect(mockHistoryFacade.confirmPayment).toHaveBeenCalledWith('pi_test_2', 'paypal');
    });
  });

  describe('clearHistory', () => {
    it('should clear history', () => {
      component.clearHistory();
      expect(mockHistoryFacade.clearHistory).toHaveBeenCalled();
    });
  });

  describe('History integration', () => {
    it('should show all history entries', () => {
      mockHistoryFacade.history.set(mockHistoryEntries);
      fixture.detectChanges();
      const history = component.history();
      expect(history.length).toBe(3);
      expect(history[0].intentId).toBe('pi_test_1');
      expect(history[1].intentId).toBe('pi_test_2');
      expect(history[2].intentId).toBe('pi_test_3');
    });

    it('should update historyCount when history changes', () => {
      mockHistoryFacade.history.set(mockHistoryEntries);
      mockHistoryFacade.historyCount.set(3);
      fixture.detectChanges();
      expect(component.historyCount()).toBe(3);
    });

    it('should handle empty history', () => {
      mockHistoryFacade.history.set([]);
      mockHistoryFacade.historyCount.set(0);
      fixture.detectChanges();
      expect(component.history().length).toBe(0);
      expect(component.historyCount()).toBe(0);
    });
  });
});
