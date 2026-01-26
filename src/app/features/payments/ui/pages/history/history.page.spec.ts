import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { PaymentHistoryFacade } from '@payments/application/facades/payment-history.facade';
import { PaymentHistoryEntry } from '@payments/application/store/payment-store.history.types';

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
    // Mock del history facade
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

  describe('Inicialización', () => {
    it('debe crear el componente', () => {
      expect(component).toBeTruthy();
    });

    it('debe exponer history del payment state', () => {
      mockHistoryFacade.history.set(mockHistoryEntries);
      fixture.detectChanges();
      expect(component.history()).toEqual(mockHistoryEntries);
    });

    it('debe exponer historyCount del payment state', () => {
      mockHistoryFacade.historyCount.set(3);
      fixture.detectChanges();
      expect(component.historyCount()).toBe(3);
    });

    it('debe exponer isLoading del payment state', () => {
      mockHistoryFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });
  });

  describe('isActionRequired', () => {
    it('debe retornar true para requires_payment_method', () => {
      expect(component.isActionRequired('requires_payment_method')).toBe(true);
    });

    it('debe retornar true para requires_confirmation', () => {
      expect(component.isActionRequired('requires_confirmation')).toBe(true);
    });

    it('debe retornar true para requires_action', () => {
      expect(component.isActionRequired('requires_action')).toBe(true);
    });

    it('debe retornar false para succeeded', () => {
      expect(component.isActionRequired('succeeded')).toBe(false);
    });

    it('debe retornar false para canceled', () => {
      expect(component.isActionRequired('canceled')).toBe(false);
    });

    it('debe retornar false para processing', () => {
      expect(component.isActionRequired('processing')).toBe(false);
    });
  });

  describe('entryToIntent', () => {
    it('debe convertir entry a PaymentIntent correctamente', () => {
      const entry = mockHistoryEntries[0];
      const intent = component.entryToIntent(entry);

      expect(intent.id).toBe(entry.intentId);
      expect(intent.provider).toBe(entry.provider);
      expect(intent.status).toBe(entry.status);
      expect(intent.amount).toBe(entry.amount);
      expect(intent.currency).toBe(entry.currency);
    });

    it('debe manejar diferentes estados', () => {
      const entry = mockHistoryEntries[1];
      const intent = component.entryToIntent(entry);
      expect(intent.status).toBe('requires_confirmation');
    });

    it('debe manejar entradas canceladas', () => {
      const entry = mockHistoryEntries[2];
      const intent = component.entryToIntent(entry);
      expect(intent.status).toBe('canceled');
    });
  });

  describe('Acciones de pago', () => {
    it('debe confirmar pago correctamente', () => {
      component.confirmPayment('pi_test_1', 'stripe');
      expect(mockHistoryFacade.confirmPayment).toHaveBeenCalledWith('pi_test_1', 'stripe');
    });

    it('debe cancelar pago correctamente', () => {
      component.cancelPayment('pi_test_1', 'stripe');
      expect(mockHistoryFacade.cancelPayment).toHaveBeenCalledWith('pi_test_1', 'stripe');
    });

    it('debe refrescar pago correctamente', () => {
      component.refreshPayment('pi_test_1', 'stripe');
      expect(mockHistoryFacade.refreshPayment).toHaveBeenCalledWith('pi_test_1', 'stripe');
    });

    it('debe funcionar con diferentes providers', () => {
      component.confirmPayment('pi_test_2', 'paypal');
      expect(mockHistoryFacade.confirmPayment).toHaveBeenCalledWith('pi_test_2', 'paypal');
    });
  });

  describe('clearHistory', () => {
    it('debe limpiar el historial', () => {
      component.clearHistory();
      expect(mockHistoryFacade.clearHistory).toHaveBeenCalled();
    });
  });

  describe('Integración con historial', () => {
    it('debe mostrar todas las entradas del historial', () => {
      mockHistoryFacade.history.set(mockHistoryEntries);
      fixture.detectChanges();
      const history = component.history();
      expect(history.length).toBe(3);
      expect(history[0].intentId).toBe('pi_test_1');
      expect(history[1].intentId).toBe('pi_test_2');
      expect(history[2].intentId).toBe('pi_test_3');
    });

    it('debe actualizar historyCount cuando cambia el historial', () => {
      mockHistoryFacade.history.set(mockHistoryEntries);
      mockHistoryFacade.historyCount.set(3);
      fixture.detectChanges();
      expect(component.historyCount()).toBe(3);
    });

    it('debe manejar historial vacío', () => {
      mockHistoryFacade.history.set([]);
      mockHistoryFacade.historyCount.set(0);
      fixture.detectChanges();
      expect(component.history().length).toBe(0);
      expect(component.historyCount()).toBe(0);
    });
  });
});
