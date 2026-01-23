import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { LoggerService } from '@core/logging';

import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import {
  FallbackAvailableEvent,
  PaymentError,
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '../../../domain/models';
import { FieldRequirements, PaymentOptions } from '../../../domain/ports';
import { CheckoutComponent } from './checkout.page';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let mockPaymentState: any;
  let mockRegistry: any;
  let mockLogger: any;
  let mockFactory: any;
  let mockBuilder: any;

  const mockIntent: PaymentIntent = {
    id: 'pi_test_123',
    provider: 'stripe',
    status: 'succeeded',
    amount: 499.99,
    currency: 'MXN',
    clientSecret: 'secret_test',
  };

  const mockError: PaymentError = {
    code: 'card_declined',
    message: 'La tarjeta fue rechazada',
    raw: { originalError: 'declined' },
  };

  const mockFallbackEvent: FallbackAvailableEvent = {
    eventId: 'fb_test_1',
    failedProvider: 'stripe',
    error: mockError,
    alternativeProviders: ['paypal'],
    originalRequest: {
      orderId: 'order_test',
      amount: 499.99,
      currency: 'MXN',
      method: { type: 'card', token: 'tok_test' },
    },
    timestamp: Date.now(),
  };

  beforeEach(async () => {
    // Mock del builder
    mockBuilder = {
      forOrder: vi.fn().mockReturnThis(),
      withAmount: vi.fn().mockReturnThis(),
      withOptions: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({
        orderId: 'order_test',
        amount: 499.99,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_test' },
      }),
    };

    // Mock de la factory
    mockFactory = {
      providerId: 'stripe' as const,
      getSupportedMethods: vi.fn(() => ['card', 'spei']),
      getFieldRequirements: vi.fn((method: PaymentMethodType): FieldRequirements => {
        if (method === 'card') {
          return {
            fields: [
              {
                name: 'token',
                label: 'Token de tarjeta',
                required: true,
                type: 'hidden',
              },
            ],
          };
        }
        return {
          fields: [
            {
              name: 'customerEmail',
              label: 'Email',
              required: true,
              type: 'email',
            },
          ],
        };
      }),
      createRequestBuilder: vi.fn(() => mockBuilder),
    };

    // Mock del registry
    mockRegistry = {
      get: vi.fn((providerId: PaymentProviderId) => {
        if (providerId === 'stripe' || providerId === 'paypal') {
          return mockFactory;
        }
        throw new Error(`Provider not found: ${providerId}`);
      }),
      getAvailableProviders: vi.fn(() => ['stripe', 'paypal']),
    };

    // Mock del payment state
    mockPaymentState = {
      isLoading: signal(false),
      isReady: signal(false),
      hasError: signal(false),
      intent: signal<PaymentIntent | null>(null),
      error: signal<PaymentError | null>(null),
      hasPendingFallback: signal(false),
      pendingFallbackEvent: signal<FallbackAvailableEvent | null>(null),
      debugSummary: signal({
        status: 'idle',
        intentId: null,
        provider: null,
        fallbackStatus: 'idle',
        historyCount: 0,
      }),
      selectProvider: vi.fn(),
      clearError: vi.fn(),
      startPayment: vi.fn(),
      confirmPayment: vi.fn(),
      cancelPayment: vi.fn(),
      refreshPayment: vi.fn(),
      reset: vi.fn(),
      executeFallback: vi.fn(),
      cancelFallback: vi.fn(),
    };

    // Mock del logger
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      startCorrelation: vi.fn(() => 'correlation_id'),
      endCorrelation: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent, RouterLink],
      providers: [
        { provide: PAYMENT_STATE, useValue: mockPaymentState },
        { provide: ProviderFactoryRegistry, useValue: mockRegistry },
        { provide: LoggerService, useValue: mockLogger },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialización', () => {
    it('debe crear el componente', () => {
      expect(component).toBeTruthy();
    });

    it('debe inicializar con valores por defecto', () => {
      expect(component.amount()).toBe(499.99);
      expect(component.currency()).toBe('MXN');
      expect(component.selectedProvider()).toBeNull();
      expect(component.selectedMethod()).toBeNull();
      expect(component.isFormValid()).toBe(false);
    });

    it('debe auto-seleccionar el primer provider disponible', () => {
      fixture.detectChanges();
      expect(component.selectedProvider()).toBe('stripe');
    });

    it('debe auto-seleccionar el primer método cuando hay provider', () => {
      fixture.detectChanges();
      component.selectedProvider.set('stripe');
      fixture.detectChanges();
      expect(component.selectedMethod()).toBe('card');
    });
  });

  describe('Providers y métodos disponibles', () => {
    it('debe obtener providers disponibles del registry', () => {
      fixture.detectChanges();
      const providers = component.availableProviders();
      expect(providers).toEqual(['stripe', 'paypal']);
      expect(mockRegistry.getAvailableProviders).toHaveBeenCalled();
    });

    it('debe obtener métodos disponibles para el provider seleccionado', () => {
      component.selectedProvider.set('stripe');
      fixture.detectChanges();
      const methods = component.availableMethods();
      expect(methods).toEqual(['card', 'spei']);
      expect(mockRegistry.get).toHaveBeenCalledWith('stripe');
      expect(mockFactory.getSupportedMethods).toHaveBeenCalled();
    });

    it('debe retornar array vacío si no hay provider seleccionado', () => {
      const methods = component.availableMethods();
      expect(methods).toEqual([]);
    });

    it('debe manejar errores al obtener métodos', () => {
      mockRegistry.get.mockImplementationOnce(() => {
        throw new Error('Provider not found');
      });
      component.selectedProvider.set('stripe' as PaymentProviderId);
      fixture.detectChanges();
      const methods = component.availableMethods();
      expect(methods).toEqual([]);
    });
  });

  describe('Requisitos de campos', () => {
    it('debe obtener field requirements para provider y método seleccionados', () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();
      expect(requirements?.fields.length).toBeGreaterThan(0);
      expect(mockFactory.getFieldRequirements).toHaveBeenCalledWith('card');
    });

    it('debe retornar null si no hay provider o método seleccionado', () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeNull();
    });

    it('debe retornar null si hay error al obtener requirements', () => {
      mockFactory.getFieldRequirements.mockImplementationOnce(() => {
        throw new Error('Error');
      });
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      const requirements = component.fieldRequirements();
      expect(requirements).toBeNull();
    });
  });

  describe('Selección de provider y método', () => {
    it('debe seleccionar provider correctamente', () => {
      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');
      expect(mockPaymentState.selectProvider).toHaveBeenCalledWith('paypal');
      expect(mockPaymentState.clearError).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Provider selected', 'CheckoutPage', {
        provider: 'paypal',
      });
    });

    it('debe seleccionar método correctamente', () => {
      component.selectMethod('spei');
      expect(component.selectedMethod()).toBe('spei');
      expect(mockPaymentState.clearError).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Method selected', 'CheckoutPage', {
        method: 'spei',
      });
    });
  });

  describe('Formulario', () => {
    it('debe actualizar form options', () => {
      const options: PaymentOptions = { token: 'tok_test' };
      component.onFormChange(options);
      expect(() => component.onFormChange(options)).not.toThrow();
    });

    it('debe actualizar form valid state', () => {
      component.onFormValidChange(true);
      expect(component.isFormValid()).toBe(true);
      component.onFormValidChange(false);
      expect(component.isFormValid()).toBe(false);
    });
  });

  describe('Proceso de pago', () => {
    beforeEach(() => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      component.isFormValid.set(true);
    });

    it('debe procesar pago correctamente con provider y método válidos', () => {
      const orderId = component.orderId();
      component.onFormChange({ token: 'tok_test' });
      component.processPayment();

      expect(mockRegistry.get).toHaveBeenCalledWith('stripe');
      expect(mockFactory.createRequestBuilder).toHaveBeenCalledWith('card');
      expect(mockBuilder.forOrder).toHaveBeenCalledWith(orderId);
      expect(mockBuilder.withAmount).toHaveBeenCalledWith(499.99, 'MXN');
      expect(mockBuilder.build).toHaveBeenCalled();
      expect(mockPaymentState.startPayment).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Payment request built',
        'CheckoutPage',
        expect.any(Object),
      );
    });

    it('no debe procesar pago si falta provider', () => {
      component.selectedProvider.set(null);
      component.processPayment();
      expect(mockPaymentState.startPayment).not.toHaveBeenCalled();
    });

    it('no debe procesar pago si falta método', () => {
      component.selectedMethod.set(null);
      component.processPayment();
      expect(mockPaymentState.startPayment).not.toHaveBeenCalled();
    });

    it('no debe procesar pago si el form es inválido', () => {
      component.isFormValid.set(false);
      component.processPayment();
      expect(mockPaymentState.startPayment).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Form invalid, payment blocked',
        'CheckoutPage',
        {
          provider: 'stripe',
          method: 'card',
        },
      );
    });

    it('sí debe procesar pago si isFormValid es true', () => {
      component.isFormValid.set(true);
      component.onFormChange({ token: 'tok_test' });
      component.processPayment();

      // Debe procesar el pago (startPayment debe ser llamado)
      expect(mockPaymentState.startPayment).toHaveBeenCalled();
      // NO debe haber log de "Form invalid, payment blocked"
      const blockedCalls = mockLogger.info.mock.calls.filter(
        (call: any[]) => call[0] === 'Form invalid, payment blocked',
      );

      expect(blockedCalls.length).toBe(0);
    });

    it('debe usar token del formulario (PaymentFormComponent maneja autofill en dev)', () => {
      // El token debe venir del formulario, no ser inyectado por CheckoutComponent
      // PaymentFormComponent ya maneja el autofill en modo desarrollo
      component.onFormChange({ token: 'tok_visa1234567890abcdef' });
      component.processPayment();
      expect(mockBuilder.withOptions).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok_visa1234567890abcdef' }),
      );
      // Ya no debe haber log de auto-generación en CheckoutComponent
      expect(mockLogger.debug).not.toHaveBeenCalledWith('Auto-generated dev token', 'CheckoutPage');
    });

    it('debe manejar errores al construir request', () => {
      mockBuilder.build.mockImplementationOnce(() => {
        throw new Error('Build failed');
      });
      component.processPayment();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to build payment request',
        'CheckoutPage',
        expect.any(Error),
      );
    });

    it('debe iniciar correlación de logging', () => {
      component.processPayment();
      expect(mockLogger.startCorrelation).toHaveBeenCalledWith(
        'payment-flow',
        expect.objectContaining({
          orderId: expect.any(String),
          provider: 'stripe',
          method: 'card',
        }),
      );
      expect(mockLogger.endCorrelation).toHaveBeenCalled();
    });
  });

  describe('Fallback', () => {
    it('debe confirmar fallback', () => {
      component.confirmFallback('paypal');
      expect(mockPaymentState.executeFallback).toHaveBeenCalledWith('paypal');
      expect(mockLogger.info).toHaveBeenCalledWith('Fallback confirmed', 'CheckoutPage', {
        provider: 'paypal',
      });
    });

    it('debe cancelar fallback', () => {
      component.cancelFallback();
      expect(mockPaymentState.cancelFallback).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Fallback cancelled', 'CheckoutPage');
    });

    it('debe detectar cuando hay fallback pendiente', () => {
      mockPaymentState.hasPendingFallback.set(true);
      mockPaymentState.pendingFallbackEvent.set(mockFallbackEvent);
      fixture.detectChanges();
      expect(component.hasPendingFallback()).toBe(true);
      expect(component.pendingFallbackEvent()).toEqual(mockFallbackEvent);
    });
  });

  describe('Estado del pago', () => {
    it('debe exponer estado de carga', () => {
      mockPaymentState.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });

    it('debe exponer estado de listo', () => {
      mockPaymentState.isReady.set(true);
      fixture.detectChanges();
      expect(component.isReady()).toBe(true);
    });

    it('debe exponer estado de error', () => {
      mockPaymentState.hasError.set(true);
      mockPaymentState.error.set(mockError);
      fixture.detectChanges();
      expect(component.hasError()).toBe(true);
      expect(component.currentError()).toEqual(mockError);
    });

    it('debe exponer intent actual', () => {
      mockPaymentState.intent.set(mockIntent);
      fixture.detectChanges();
      expect(component.currentIntent()).toEqual(mockIntent);
    });

    it('debe mostrar resultado cuando está listo o hay error', () => {
      mockPaymentState.isReady.set(true);
      fixture.detectChanges();
      expect(component.showResult()).toBe(true);

      mockPaymentState.isReady.set(false);
      mockPaymentState.hasError.set(true);
      fixture.detectChanges();
      expect(component.showResult()).toBe(true);
    });
  });

  describe('Reset', () => {
    it('debe resetear el pago', () => {
      component.resetPayment();
      expect(mockPaymentState.reset).toHaveBeenCalled();
      expect(component.isFormValid()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Payment reset', 'CheckoutPage');
      // El orderId debe cambiar
      const newOrderId = component.orderId();
      expect(newOrderId).toBeTruthy();
    });
  });

  describe('Debug info', () => {
    it('debe exponer debug summary del estado', () => {
      const debugSummary = component.debugInfo();
      expect(debugSummary).toBeTruthy();
      expect(debugSummary.status).toBe('idle');
    });
  });
});
