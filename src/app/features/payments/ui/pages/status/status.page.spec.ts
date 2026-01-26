import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

import { PaymentFlowFacade } from '../../../application/state-machine/payment-flow.facade';
import { StatusComponent } from './status.page';

describe('StatusComponent', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;
  let mockFlowFacade: any;

  const mockIntent: PaymentIntent = {
    id: 'pi_test_123',
    provider: 'stripe',
    status: 'succeeded',
    amount: 499.99,
    currency: 'MXN',
    clientSecret: 'secret_test',
  };

  const mockError: PaymentError = {
    code: 'provider_error',
    messageKey: I18nKeys.errors.provider_error,
    raw: { originalError: 'not_found' },
  };

  beforeEach(async () => {
    // Mock del flow
    mockFlowFacade = {
      intent: signal<PaymentIntent | null>(null),
      error: signal<PaymentError | null>(null),
      isLoading: signal(false),
      refresh: vi.fn(() => true),
      confirm: vi.fn(() => true),
      cancel: vi.fn(() => true),
    };

    await TestBed.configureTestingModule({
      imports: [StatusComponent, RouterLink],
      providers: [{ provide: PaymentFlowFacade, useValue: mockFlowFacade }, provideRouter([])],
    }).compileComponents();

    const i18n = TestBed.inject(I18nService);
    vi.spyOn(i18n, 't').mockImplementation((key: string) => key);

    fixture = TestBed.createComponent(StatusComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialización', () => {
    it('debe crear el componente', () => {
      expect(component).toBeTruthy();
    });

    it('debe inicializar con valores por defecto', () => {
      expect(component.intentId).toBe('');
      expect(component.selectedProvider()).toBe('stripe');
      expect(component.result()).toBeNull();
    });

    it('debe tener ejemplos predefinidos', () => {
      expect(component.examples()).toHaveLength(2);
      expect(component.examples()[0].provider).toBe('stripe');
      expect(component.examples()[1].provider).toBe('paypal');
    });
  });

  describe('Búsqueda de intent', () => {
    it('no debe buscar si el intentId está vacío', () => {
      component.intentId = '';
      component.searchIntent();
      expect(mockFlowFacade.refresh).not.toHaveBeenCalled();
    });

    it('no debe buscar si el intentId solo tiene espacios', () => {
      component.intentId = '   ';
      component.searchIntent();
      expect(mockFlowFacade.refresh).not.toHaveBeenCalled();
    });

    it('debe buscar intent y resetear result', () => {
      component.intentId = 'pi_test_123';
      component.searchIntent();

      expect(component.result()).toBeNull(); // Se resetea
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });

    it('debe actualizar result automáticamente cuando el intent cambia (via effect)', () => {
      // El effect() en el constructor escucha cambios en intent()
      mockFlowFacade.intent.set(mockIntent);
      fixture.detectChanges();

      expect(component.result()).toEqual(mockIntent);
    });

    it('debe usar el provider seleccionado', () => {
      component.selectedProvider.set('paypal');
      component.intentId = 'ORDER_FAKE_XYZ';
      component.searchIntent();

      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('paypal', 'ORDER_FAKE_XYZ');
    });

    it('debe recortar espacios en blanco del intentId', () => {
      component.intentId = '  pi_test_123  ';
      component.searchIntent();

      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });
  });

  describe('Acciones de pago', () => {
    it('debe confirmar pago correctamente', () => {
      component.confirmPayment('pi_test_123');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('debe cancelar pago correctamente', () => {
      component.cancelPayment('pi_test_123');
      expect(mockFlowFacade.cancel).toHaveBeenCalled();
    });

    it('debe refrescar pago correctamente', () => {
      component.refreshPayment('pi_test_123');
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });

    it('debe usar el provider seleccionado para las acciones', () => {
      component.selectedProvider.set('paypal');
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });
  });

  describe('Ejemplos', () => {
    it('debe usar ejemplo y actualizar intentId y provider', () => {
      const example = component.examples()[0];
      component.useExample(example);
      expect(component.intentId).toBe(example.id);
      expect(component.selectedProvider()).toBe(example.provider);
    });

    it('debe funcionar con ejemplos de PayPal', () => {
      const example = component.examples()[1];
      component.useExample(example);
      expect(component.intentId).toBe(example.id);
      expect(component.selectedProvider()).toBe('paypal');
    });
  });

  describe('Manejo de errores', () => {
    it('debe obtener mensaje de error correctamente', () => {
      const errorMsg = component.getErrorMessage(mockError);
      expect(errorMsg).toBe('errors.provider_error');
    });

    it('debe retornar mensaje genérico para errores desconocidos', () => {
      const errorMsg = component.getErrorMessage('string error');
      expect(errorMsg).toBe('errors.unknown_error');
    });

    it('debe retornar mensaje genérico para objetos sin message', () => {
      const errorMsg = component.getErrorMessage({ code: 'unknown' });
      expect(errorMsg).toBe('errors.unknown_error');
    });

    it('debe exponer error del payment state', () => {
      mockFlowFacade.error.set(mockError);
      fixture.detectChanges();
      expect(component.error()).toEqual(mockError);
    });
  });

  describe('Estado del componente', () => {
    it('debe exponer isLoading del payment state', () => {
      mockFlowFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });

    it('debe exponer error del payment state', () => {
      mockFlowFacade.error.set(mockError);
      fixture.detectChanges();
      expect(component.error()).toEqual(mockError);
    });
  });
});
