import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { signal } from '@angular/core';
import { ReturnComponent } from './return.page';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentIntent } from '../../../domain/models';
import { I18nService } from '@core/i18n';

describe('ReturnComponent', () => {
  let component: ReturnComponent;
  let fixture: ComponentFixture<ReturnComponent>;
  let mockPaymentState: any;
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

    // Mock del payment state
    mockPaymentState = {
      intent: signal<PaymentIntent | null>(null),
      isLoading: signal(false),
      confirmPayment: vi.fn(),
      refreshPayment: vi.fn(),
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
        { provide: PAYMENT_STATE, useValue: mockPaymentState },
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
      expect(mockPaymentState.refreshPayment).toHaveBeenCalledWith(
        { intentId: 'pi_test_123' },
        'stripe',
      );
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
      expect(mockPaymentState.refreshPayment).toHaveBeenCalledWith(
        { intentId: 'ORDER_FAKE_XYZ' },
        'paypal',
      );
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
      expect(mockPaymentState.refreshPayment).not.toHaveBeenCalled();
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
      expect(mockPaymentState.confirmPayment).toHaveBeenCalledWith(
        { intentId: 'pi_test_123' },
        'stripe',
      );
    });

    it('debe confirmar pago de PayPal correctamente', () => {
      component.paypalToken.set('ORDER_FAKE_XYZ');
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockPaymentState.confirmPayment).toHaveBeenCalledWith(
        { intentId: 'ORDER_FAKE_XYZ' },
        'paypal',
      );
    });

    it('debe refrescar pago correctamente', () => {
      component.intentId.set('pi_test_123');
      component.refreshPayment('pi_test_123');
      expect(mockPaymentState.refreshPayment).toHaveBeenCalledWith(
        { intentId: 'pi_test_123' },
        'stripe',
      );
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
      mockPaymentState.intent.set(mockIntent);
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
      expect(component.flowType()).toBe('PayPal Redirect');
    });

    it('debe detectar tipo de flujo 3DS', () => {
      component.intentId.set('pi_test_123');
      // Las computed de Signals se actualizan inmediatamente
      expect(component.flowType()).toBe('3D Secure');
    });

    it('debe retornar desconocido si no hay parámetros', () => {
      expect(component.flowType()).toBe('Desconocido');
    });
  });

  describe('Estado del componente', () => {
    it('debe exponer currentIntent del payment state', () => {
      mockPaymentState.intent.set(mockIntent);
      fixture.detectChanges();
      expect(component.currentIntent()).toEqual(mockIntent);
    });

    it('debe exponer isLoading del payment state', () => {
      mockPaymentState.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });
  });
});
