import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

import { PaymentFlowFacade } from '../../../application/state-machine/payment-flow.facade';
import { ReturnComponent } from './return.page';

describe('ReturnComponent', () => {
  let component: ReturnComponent;
  let fixture: ComponentFixture<ReturnComponent>;
  let mockFlowFacade: any;
  let mockActivatedRoute: any;

  const mockIntent: PaymentIntent = {
    id: 'pi_test_123',
    provider: 'stripe',
    status: 'succeeded',
    amount: 499.99,
    currency: 'MXN',
    clientSecret: 'secret_test',
  };

  beforeEach(async () => {
    // Mock del ActivatedRoute
    mockActivatedRoute = {
      snapshot: {
        data: {},
        queryParams: {},
      },
    };

    // Mock del flow
    mockFlowFacade = {
      intent: signal<PaymentIntent | null>(null),
      isLoading: signal(false),
      confirm: vi.fn(() => true),
      refresh: vi.fn(() => true),
    };

    // Mock del I18nService
    const mockI18n: I18nService = {
      t: vi.fn((key: string) => {
        // Retornar la traducción en español para el test
        if (key === 'ui.flow_unknown') return 'Desconocido';
        return key;
      }),
      has: vi.fn(() => true),
      setLanguage: vi.fn(),
      getLanguage: vi.fn(() => 'es'),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ReturnComponent, RouterLink],
      providers: [
        { provide: PaymentFlowFacade, useValue: mockFlowFacade },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReturnComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialización', () => {
    it('debe crear el componente', () => {
      expect(component).toBeTruthy();
    });

    it('debe inicializar con valores vacíos', () => {
      expect(component.intentId()).toBeNull();
      expect(component.paypalToken()).toBeNull();
      expect(component.paypalPayerId()).toBeNull();
      expect(component.redirectStatus()).toBeNull();
      expect(component.isReturnFlow()).toBe(false);
      expect(component.isCancelFlow()).toBe(false);
    });
  });

  describe('ngOnInit - Flujo de retorno Stripe', () => {
    it('debe detectar flujo de retorno desde route data', () => {
      mockActivatedRoute.snapshot.data = { returnFlow: true };
      component.ngOnInit();
      expect(component.isReturnFlow()).toBe(true);
    });

    it('debe leer payment_intent de query params', () => {
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
        redirect_status: 'succeeded',
      };
      component.ngOnInit();
      expect(component.intentId()).toBe('pi_test_123');
      expect(component.redirectStatus()).toBe('succeeded');
    });

    it('debe leer setup_intent de query params', () => {
      mockActivatedRoute.snapshot.queryParams = {
        setup_intent: 'seti_test_123',
      };
      component.ngOnInit();
      expect(component.intentId()).toBe('seti_test_123');
    });

    it('debe refrescar pago si hay intentId y no es cancel flow', () => {
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
      };
      component.ngOnInit();
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });
  });

  describe('ngOnInit - Flujo de retorno PayPal', () => {
    it('debe leer token y PayerID de PayPal', () => {
      mockActivatedRoute.snapshot.queryParams = {
        token: 'ORDER_FAKE_XYZ',
        PayerID: 'PAYER123456',
      };
      component.ngOnInit();
      expect(component.paypalToken()).toBe('ORDER_FAKE_XYZ');
      expect(component.paypalPayerId()).toBe('PAYER123456');
    });

    it('debe refrescar pago si hay token de PayPal', () => {
      mockActivatedRoute.snapshot.queryParams = {
        token: 'ORDER_FAKE_XYZ',
      };
      component.ngOnInit();
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('paypal', 'ORDER_FAKE_XYZ');
    });
  });

  describe('ngOnInit - Flujo de cancelación', () => {
    it('debe detectar flujo de cancelación desde route data', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      component.ngOnInit();
      expect(component.isCancelFlow()).toBe(true);
    });

    it('no debe refrescar pago si es cancel flow', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
      };
      component.ngOnInit();
      expect(mockFlowFacade.refresh).not.toHaveBeenCalled();
    });

    it('debe detectar cancelación desde redirect_status', () => {
      mockActivatedRoute.snapshot.queryParams = {
        redirect_status: 'canceled',
      };
      component.ngOnInit();
      expect(component.isCancel()).toBe(true);
    });
  });

  describe('Detectar provider', () => {
    it('debe detectar PayPal si hay token de PayPal', () => {
      component.paypalToken.set('ORDER_FAKE_XYZ');
      const provider = (component as any).detectProvider();
      expect(provider).toBe('paypal');
    });

    it('debe detectar Stripe por defecto', () => {
      const provider = (component as any).detectProvider();
      expect(provider).toBe('stripe');
    });
  });

  describe('Acciones de pago', () => {
    it('debe confirmar pago correctamente', () => {
      component.intentId.set('pi_test_123');
      component.paypalToken.set(null); // Stripe
      component.confirmPayment('pi_test_123');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('debe confirmar pago de PayPal correctamente', () => {
      component.paypalToken.set('ORDER_FAKE_XYZ');
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('debe refrescar pago correctamente', () => {
      component.intentId.set('pi_test_123');
      component.refreshPaymentByReference('pi_test_123');
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });
  });

  describe('Computed properties', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('debe detectar cancelación desde isCancelFlow', () => {
      component.isCancelFlow.set(true);
      // Las computed de Signals se actualizan inmediatamente
      expect(component.isCancel()).toBe(true);
    });

    it('debe detectar cancelación desde redirectStatus', () => {
      component.redirectStatus.set('canceled');
      // Las computed de Signals se actualizan inmediatamente
      expect(component.isCancel()).toBe(true);
    });

    it('debe detectar éxito desde intent status', () => {
      mockFlowFacade.intent.set(mockIntent);
      fixture.detectChanges();
      expect(component.isSuccess()).toBe(true);
    });

    it('debe detectar éxito desde redirectStatus', () => {
      component.redirectStatus.set('succeeded');
      // Las computed de Signals se actualizan inmediatamente
      expect(component.isSuccess()).toBe(true);
    });

    it('debe detectar tipo de flujo PayPal', () => {
      component.paypalToken.set('ORDER_FAKE_XYZ');
      // Las computed de Signals se actualizan inmediatamente
      expect(component.flowType()).toBe(I18nKeys.ui.flow_paypal_redirect);
    });

    it('debe detectar tipo de flujo 3DS', () => {
      component.intentId.set('pi_test_123');
      // Las computed de Signals se actualizan inmediatamente
      expect(component.flowType()).toBe(I18nKeys.ui.flow_3ds);
    });

    it('debe retornar desconocido si no hay parámetros', () => {
      expect(component.flowType()).toBe('Desconocido');
    });
  });

  describe('Estado del componente', () => {
    it('debe exponer currentIntent del payment state', () => {
      mockFlowFacade.intent.set(mockIntent);
      fixture.detectChanges();
      expect(component.currentIntent()).toEqual(mockIntent);
    });

    it('debe exponer isLoading del payment state', () => {
      mockFlowFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });
  });
});
