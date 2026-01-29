import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { patchState } from '@ngrx/signals';
import { mapReturnQueryToReference } from '@payments/application/adapters/events/external/payment-flow-return.mapper';
import { ExternalEventAdapter } from '@payments/application/adapters/events/external-event.adapter';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { ReturnComponent } from '@payments/ui/pages/return/return.page';

describe('ReturnComponent', () => {
  let component: ReturnComponent;
  let fixture: ComponentFixture<ReturnComponent>;
  let mockFlowFacade: any;
  let mockActivatedRoute: any;
  let mockExternalEvents: any;

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

    // Flow mock
    mockFlowFacade = {
      intent: signal<PaymentIntent | null>(null),
      isLoading: signal(false),
      confirm: vi.fn(() => true),
      refresh: vi.fn(() => true),
    };

    mockExternalEvents = {
      redirectReturned: vi.fn(),
      externalStatusUpdated: vi.fn(),
      webhookReceived: vi.fn(),
    };

    // I18nService mock
    const mockI18n: I18nService = {
      t: vi.fn((key: string) => {
        // Return an English translation for the test
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
        { provide: PaymentFlowFacade, useValue: mockFlowFacade },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: I18nService, useValue: mockI18n },
        { provide: ExternalEventAdapter, useValue: mockExternalEvents },
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
      expect(mockExternalEvents.redirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'stripe', referenceId: 'pi_test_123' }),
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
      expect(mockExternalEvents.redirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'paypal', referenceId: 'ORDER_FAKE_XYZ' }),
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
      expect(mockExternalEvents.redirectReturned).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'stripe', referenceId: 'pi_test_123' }),
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
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('should confirm PayPal payment', () => {
      patchState(component.returnPageState, {
        paypalToken: 'ORDER_FAKE_XYZ',
      });
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('should refresh payment', () => {
      patchState(component.returnPageState, {
        intentId: 'pi_test_123',
      });
      component.refreshPaymentByReference('pi_test_123');
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
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
      mockFlowFacade.intent.set(mockIntent);
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

  describe('Component state', () => {
    it('should expose currentIntent from payment state', () => {
      mockFlowFacade.intent.set(mockIntent);
      fixture.detectChanges();
      expect(component.flowState.currentIntent()).toEqual(mockIntent);
    });

    it('should expose isLoading from payment state', () => {
      mockFlowFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.flowState.isLoading()).toBe(true);
    });
  });
});
