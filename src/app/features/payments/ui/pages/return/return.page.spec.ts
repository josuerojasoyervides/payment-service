import type { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { mapReturnQueryToReference } from '@app/features/payments/application/adapters/events/external/mappers/payment-flow-return.mapper';
import { createMockPaymentState } from '@app/features/payments/application/api/testing/provide-mock-payment-state.harness';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { I18nKeys, I18nService } from '@core/i18n';
import { patchState } from '@ngrx/signals';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { ReturnComponent } from '@payments/ui/pages/return/return.page';

describe('ReturnComponent', () => {
  let component: ReturnComponent;
  let fixture: ComponentFixture<ReturnComponent>;
  let mockState: PaymentFlowPort & {
    confirmPayment: ReturnType<typeof vi.fn>;
    refreshPayment: ReturnType<typeof vi.fn>;
    intent: ReturnType<typeof signal<PaymentIntent | null>>;
  };
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
    // ActivatedRoute mock
    mockActivatedRoute = {
      snapshot: {
        data: {},
        queryParams: {},
      },
    };

    const baseMock = createMockPaymentState();
    mockState = {
      ...baseMock,
      intent: baseMock.intent as ReturnType<typeof signal<PaymentIntent | null>>,
      confirmPayment: vi.fn(),
      refreshPayment: vi.fn(),
      notifyRedirectReturned: vi.fn(),
    } as PaymentFlowPort & {
      confirmPayment: ReturnType<typeof vi.fn>;
      refreshPayment: ReturnType<typeof vi.fn>;
      notifyRedirectReturned: ReturnType<typeof vi.fn>;
      intent: ReturnType<typeof signal<PaymentIntent | null>>;
    };

    // I18nService mock
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

    it('should initialize with empty values', () => {
      expect(component.returnPageState.intentId()).toBeNull();
      expect(component.returnPageState.paypalToken()).toBeNull();
      expect(component.returnPageState.paypalPayerId()).toBeNull();
      expect(component.returnPageState.redirectStatus()).toBeNull();
      expect(component.returnPageState.isReturnFlow()).toBe(false);
      expect(component.returnPageState.isCancelFlow()).toBe(false);
    });
  });

  describe('ngOnInit - Stripe return flow', () => {
    it('should detect return flow from route data', () => {
      mockActivatedRoute.snapshot.data = { returnFlow: true };
      component.ngOnInit();
      expect(component.returnPageState.isReturnFlow()).toBe(true);
    });

    it('should read payment_intent from query params', () => {
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
        redirect_status: 'succeeded',
      };
      component.ngOnInit();
      expect(component.returnPageState.intentId()).toBe('pi_test_123');
      expect(component.returnPageState.redirectStatus()).toBe('succeeded');
    });

    it('should read setup_intent from query params', () => {
      mockActivatedRoute.snapshot.queryParams = {
        setup_intent: 'seti_test_123',
      };
      component.ngOnInit();
      expect(component.returnPageState.intentId()).toBe('seti_test_123');
    });

    it('should emit redirect return when intentId exists', () => {
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
      };
      component.ngOnInit();
      expect(mockState.notifyRedirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_123' }),
      );
    });
  });

  describe('ngOnInit - PayPal return flow', () => {
    it('should read PayPal token and PayerID', () => {
      mockActivatedRoute.snapshot.queryParams = {
        token: 'ORDER_FAKE_XYZ',
        PayerID: 'PAYER123456',
      };
      component.ngOnInit();
      expect(component.returnPageState.paypalToken()).toBe('ORDER_FAKE_XYZ');
      expect(component.returnPageState.paypalPayerId()).toBe('PAYER123456');
    });

    it('should emit redirect return when PayPal token exists', () => {
      mockActivatedRoute.snapshot.queryParams = {
        token: 'ORDER_FAKE_XYZ',
      };
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

    it('should still emit redirect return when cancel flow', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
      };
      component.ngOnInit();
      expect(mockState.notifyRedirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_test_123' }),
      );
    });

    it('should detect cancellation from redirect_status', () => {
      mockActivatedRoute.snapshot.queryParams = {
        redirect_status: 'canceled',
      };
      component.ngOnInit();
      expect(component.isCancel()).toBe(true);
    });
  });

  describe('Return mapper', () => {
    it('should detect PayPal when PayPal token exists', () => {
      const reference = mapReturnQueryToReference({ token: 'ORDER_FAKE_XYZ' });
      expect(reference.providerId).toBe('paypal');
    });

    it('should detect Stripe by default', () => {
      const reference = mapReturnQueryToReference({});
      expect(reference.providerId).toBe('stripe');
    });
  });

  describe('Payment actions', () => {
    it('should confirm payment', () => {
      patchState(component.returnPageState, {
        intentId: 'pi_test_123',
        paypalToken: null,
      });
      component.confirmPayment('pi_test_123');
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' });
    });

    it('should confirm PayPal payment', () => {
      mockActivatedRoute.snapshot.queryParams = { token: 'ORDER_FAKE_XYZ' };
      patchState(component.returnPageState, {
        paypalToken: 'ORDER_FAKE_XYZ',
      });
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'ORDER_FAKE_XYZ' });
    });

    it('should refresh payment', () => {
      patchState(component.returnPageState, {
        intentId: 'pi_test_123',
      });
      component.refreshPaymentByReference('pi_test_123');
      expect(mockState.refreshPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' });
    });
  });

  describe('Computed properties', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should detect cancellation from isCancelFlow', () => {
      patchState(component.returnPageState, {
        isCancelFlow: true,
      });
      // Signals computed values update immediately
      expect(component.isCancel()).toBe(true);
    });

    it('should detect cancellation from redirectStatus', () => {
      patchState(component.returnPageState, {
        redirectStatus: 'canceled',
      });
      // Signals computed values update immediately
      expect(component.isCancel()).toBe(true);
    });

    it('should detect success from intent status', () => {
      (mockState.intent as ReturnType<typeof signal<PaymentIntent | null>>).set(mockIntent);
      fixture.detectChanges();
      expect(component.isSuccess()).toBe(true);
    });

    it('should detect success from redirectStatus', () => {
      patchState(component.returnPageState, {
        redirectStatus: 'succeeded',
      });
      // Signals computed values update immediately
      expect(component.isSuccess()).toBe(true);
    });

    it('should detect PayPal flow type', () => {
      patchState(component.returnPageState, {
        paypalToken: 'ORDER_FAKE_XYZ',
      });
      // Signals computed values update immediately
      expect(component.flowType()).toBe(I18nKeys.ui.flow_paypal_redirect);
    });

    it('should detect 3DS flow type', () => {
      patchState(component.returnPageState, {
        intentId: 'pi_test_123',
      });
      // Signals computed values update immediately
      expect(component.flowType()).toBe(I18nKeys.ui.flow_3ds);
    });

    it('should return unknown when there are no params', () => {
      expect(component.flowType()).toBe('Unknown');
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
