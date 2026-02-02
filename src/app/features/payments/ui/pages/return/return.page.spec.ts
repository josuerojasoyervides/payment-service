import type { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { createMockPaymentState } from '@app/features/payments/application/api/testing/provide-mock-payment-state.harness';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys, I18nService } from '@core/i18n';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { ReturnComponent } from '@payments/ui/pages/return/return.page';

describe('ReturnComponent', () => {
  let component: ReturnComponent;
  let fixture: ComponentFixture<ReturnComponent>;
  let mockState: PaymentFlowPort & {
    confirmPayment: ReturnType<typeof vi.fn>;
    refreshPayment: ReturnType<typeof vi.fn>;
    selectProvider: ReturnType<typeof vi.fn>;
    intent: ReturnType<typeof signal<PaymentIntent | null>>;
  };
  let mockActivatedRoute: {
    snapshot: { data: Record<string, unknown>; queryParams: Record<string, string> };
  };
  const mockCatalog = {
    getProviderDescriptor: (id: PaymentProviderId) => ({ id, labelKey: `ui.provider_${id}` }),
  };

  const mockIntent: PaymentIntent = {
    id: 'pi_test_123',
    provider: 'stripe',
    status: 'succeeded',
    money: { amount: 499.99, currency: 'MXN' },
    clientSecret: 'secret_test',
  };

  beforeEach(async () => {
    mockActivatedRoute = {
      snapshot: { data: {}, queryParams: {} },
    };

    const baseMock = createMockPaymentState();
    mockState = {
      ...baseMock,
      intent: baseMock.intent as ReturnType<typeof signal<PaymentIntent | null>>,
      confirmPayment: vi.fn(),
      refreshPayment: vi.fn(),
      notifyRedirectReturned: vi.fn(),
      selectProvider: vi.fn(),
    } as PaymentFlowPort & {
      confirmPayment: ReturnType<typeof vi.fn>;
      refreshPayment: ReturnType<typeof vi.fn>;
      selectProvider: ReturnType<typeof vi.fn>;
      intent: ReturnType<typeof signal<PaymentIntent | null>>;
    };

    const mockI18n: I18nService = {
      t: vi.fn((key: string) => {
        if (key === 'ui.flow_unknown') return 'Unknown';
        return key;
      }),
      has: vi.fn(() => true),
      setLanguage: vi.fn(),
      getLanguage: vi.fn(() => 'es'),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ReturnComponent, RouterLink],
      providers: [
        { provide: PAYMENT_STATE, useValue: mockState },
        { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReturnComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with empty route data and set returnReference from port', () => {
      component.ngOnInit();
      expect(component.returnPageState.isReturnFlow()).toBe(false);
      expect(component.returnPageState.isCancelFlow()).toBe(false);
      expect(component.returnPageState.returnReference()).toBeDefined();
    });
  });

  describe('ngOnInit - return flow', () => {
    it('should detect return flow from route data', () => {
      mockActivatedRoute.snapshot.data = { returnFlow: true };
      component.ngOnInit();
      expect(component.returnPageState.isReturnFlow()).toBe(true);
    });

    it('should set returnReference from port when payment_intent in params', () => {
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
        redirect_status: 'succeeded',
      };
      component.ngOnInit();
      const ref = component.returnPageState.returnReference();
      expect(ref?.referenceId).toBe('pi_test_123');
      expect(ref?.providerId).toBeDefined();
    });

    it('should call notifyRedirectReturned with normalized params', () => {
      mockActivatedRoute.snapshot.queryParams = { payment_intent: 'pi_test_123' };
      component.ngOnInit();
      expect(mockState.notifyRedirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_123' }),
      );
    });

    it('should call selectProvider when port returns providerId', () => {
      mockActivatedRoute.snapshot.queryParams = { payment_intent: 'pi_test_123' };
      component.ngOnInit();
      expect(mockState.selectProvider).toHaveBeenCalled();
    });
  });

  describe('ngOnInit - redirect return', () => {
    it('should set returnReference from port when token in params', () => {
      mockActivatedRoute.snapshot.queryParams = { token: 'ORDER_FAKE_XYZ' };
      component.ngOnInit();
      const ref = component.returnPageState.returnReference();
      expect(ref?.referenceId).toBe('ORDER_FAKE_XYZ');
    });

    it('should call notifyRedirectReturned with normalized params', () => {
      mockActivatedRoute.snapshot.queryParams = { token: 'ORDER_FAKE_XYZ' };
      component.ngOnInit();
      expect(mockState.notifyRedirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'ORDER_FAKE_XYZ' }),
      );
    });
  });

  describe('ngOnInit - Cancel flow', () => {
    it('should detect cancel flow from route data', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      component.ngOnInit();
      expect(component.returnPageState.isCancelFlow()).toBe(true);
    });

    it('should still call notifyRedirectReturned when cancel flow', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      mockActivatedRoute.snapshot.queryParams = { payment_intent: 'pi_test_123' };
      component.ngOnInit();
      expect(mockState.notifyRedirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_123' }),
      );
    });

    it('should set isCancel from route data only', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      component.ngOnInit();
      expect(component.isCancel()).toBe(true);
    });
  });

  describe('Payment actions', () => {
    it('should confirm payment', () => {
      mockActivatedRoute.snapshot.queryParams = { payment_intent: 'pi_test_123' };
      component.ngOnInit();
      component.confirmPayment('pi_test_123');
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' });
    });

    it('should refresh payment with providerId from returnReference', () => {
      mockActivatedRoute.snapshot.queryParams = { payment_intent: 'pi_test_123' };
      component.ngOnInit();
      component.refreshPaymentByReference('pi_test_123');
      expect(mockState.refreshPayment).toHaveBeenCalledWith(
        { intentId: 'pi_test_123' },
        expect.any(String),
      );
    });
  });

  describe('Computed properties', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should detect cancellation from isCancelFlow only', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      component.ngOnInit();
      expect(component.isCancel()).toBe(true);
    });

    it('should detect success from intent status', () => {
      mockActivatedRoute.snapshot.queryParams = { payment_intent: 'pi_test_123' };
      component.ngOnInit();
      (mockState.intent as ReturnType<typeof signal<PaymentIntent | null>>).set(mockIntent);
      fixture.detectChanges();
      expect(component.isSuccess()).toBe(true);
    });

    it('should show flow type label from returnReference provider', () => {
      mockActivatedRoute.snapshot.queryParams = { payment_intent: 'pi_test_123' };
      component.ngOnInit();
      expect(component.returnFlowTypeLabel()).toBeDefined();
    });
  });

  describe('Error surface', () => {
    it('should render flow error and Try again CTA when state has error', () => {
      const flowError = {
        code: 'missing_provider' as const,
        messageKey: I18nKeys.errors.missing_provider,
        raw: undefined,
      };
      const baseMock = createMockPaymentState({ hasError: true, error: flowError });
      const clearErrorSpy = vi.fn();
      const errorMock = { ...baseMock, clearError: clearErrorSpy };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ReturnComponent, RouterLink],
        providers: [
          { provide: PAYMENT_STATE, useValue: errorMock },
          { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
          {
            provide: I18nService,
            useValue: {
              t: (k: string) =>
                k === I18nKeys.errors.missing_provider ? 'Payment provider is required.' : k,
              has: () => true,
              setLanguage: () => {},
              getLanguage: () => 'es',
            },
          },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(ReturnComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Payment provider is required.');
      const tryAgainBtn = el.querySelector('button.btn-primary');
      expect(tryAgainBtn).toBeTruthy();
      (tryAgainBtn as HTMLButtonElement).click();
      expect(clearErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Component state', () => {
    it('should expose currentIntent from payment state', () => {
      (mockState.intent as ReturnType<typeof signal<PaymentIntent | null>>).set(mockIntent);
      fixture.detectChanges();
      expect(component.flowState.currentIntent()).toEqual(mockIntent);
    });

    it('should expose isLoading from payment state', () => {
      const loadingMock = createMockPaymentState({ isLoading: true });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ReturnComponent, RouterLink],
        providers: [
          { provide: PAYMENT_STATE, useValue: loadingMock },
          { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
          {
            provide: I18nService,
            useValue: {
              t: (k: string) => k,
              has: () => true,
              setLanguage: () => {},
              getLanguage: () => 'es',
            },
          },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(ReturnComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.flowState.isLoading()).toBe(true);
    });
  });
});
