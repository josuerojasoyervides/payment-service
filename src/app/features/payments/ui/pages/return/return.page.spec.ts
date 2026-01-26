import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

import { ExternalEventAdapter } from '../../../application/adapters/external-event.adapter';
import { mapReturnQueryToReference } from '../../../application/events/external/payment-flow-return.mapper';
import { PaymentFlowFacade } from '../../../application/state-machine/payment-flow.facade';
import { ReturnComponent } from './return.page';

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
      providerUpdate: vi.fn(),
      webhookReceived: vi.fn(),
      validationFailed: vi.fn(),
      statusConfirmed: vi.fn(),
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
      expect(component.intentId()).toBeNull();
      expect(component.paypalToken()).toBeNull();
      expect(component.paypalPayerId()).toBeNull();
      expect(component.redirectStatus()).toBeNull();
      expect(component.isReturnFlow()).toBe(false);
      expect(component.isCancelFlow()).toBe(false);
    });
  });

  describe('ngOnInit - Stripe return flow', () => {
    it('should detect return flow from route data', () => {
      mockActivatedRoute.snapshot.data = { returnFlow: true };
      component.ngOnInit();
      expect(component.isReturnFlow()).toBe(true);
    });

    it('should read payment_intent from query params', () => {
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
        redirect_status: 'succeeded',
      };
      component.ngOnInit();
      expect(component.intentId()).toBe('pi_test_123');
      expect(component.redirectStatus()).toBe('succeeded');
    });

    it('should read setup_intent from query params', () => {
      mockActivatedRoute.snapshot.queryParams = {
        setup_intent: 'seti_test_123',
      };
      component.ngOnInit();
      expect(component.intentId()).toBe('seti_test_123');
    });

    it('should refresh payment when intentId exists and not cancel flow', () => {
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
      };
      component.ngOnInit();
      expect(mockExternalEvents.providerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'stripe', referenceId: 'pi_test_123' }),
        { refresh: true },
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
      expect(component.paypalToken()).toBe('ORDER_FAKE_XYZ');
      expect(component.paypalPayerId()).toBe('PAYER123456');
    });

    it('should refresh payment when PayPal token exists', () => {
      mockActivatedRoute.snapshot.queryParams = {
        token: 'ORDER_FAKE_XYZ',
      };
      component.ngOnInit();
      expect(mockExternalEvents.providerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'paypal', referenceId: 'ORDER_FAKE_XYZ' }),
        { refresh: true },
      );
    });
  });

  describe('ngOnInit - Cancel flow', () => {
    it('should detect cancel flow from route data', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      component.ngOnInit();
      expect(component.isCancelFlow()).toBe(true);
    });

    it('should not refresh payment when cancel flow', () => {
      mockActivatedRoute.snapshot.data = { cancelFlow: true };
      mockActivatedRoute.snapshot.queryParams = {
        payment_intent: 'pi_test_123',
      };
      component.ngOnInit();
      expect(mockExternalEvents.providerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'stripe', referenceId: 'pi_test_123' }),
        { refresh: false },
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
      component.intentId.set('pi_test_123');
      component.paypalToken.set(null); // Stripe
      component.confirmPayment('pi_test_123');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('should confirm PayPal payment', () => {
      component.paypalToken.set('ORDER_FAKE_XYZ');
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('should refresh payment', () => {
      component.intentId.set('pi_test_123');
      component.refreshPaymentByReference('pi_test_123');
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });
  });

  describe('Computed properties', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should detect cancellation from isCancelFlow', () => {
      component.isCancelFlow.set(true);
      // Signals computed values update immediately
      expect(component.isCancel()).toBe(true);
    });

    it('should detect cancellation from redirectStatus', () => {
      component.redirectStatus.set('canceled');
      // Signals computed values update immediately
      expect(component.isCancel()).toBe(true);
    });

    it('should detect success from intent status', () => {
      mockFlowFacade.intent.set(mockIntent);
      fixture.detectChanges();
      expect(component.isSuccess()).toBe(true);
    });

    it('should detect success from redirectStatus', () => {
      component.redirectStatus.set('succeeded');
      // Signals computed values update immediately
      expect(component.isSuccess()).toBe(true);
    });

    it('should detect PayPal flow type', () => {
      component.paypalToken.set('ORDER_FAKE_XYZ');
      // Signals computed values update immediately
      expect(component.flowType()).toBe(I18nKeys.ui.flow_paypal_redirect);
    });

    it('should detect 3DS flow type', () => {
      component.intentId.set('pi_test_123');
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
      expect(component.currentIntent()).toEqual(mockIntent);
    });

    it('should expose isLoading from payment state', () => {
      mockFlowFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });
  });
});
