import type { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { createMockPaymentState } from '@app/features/payments/application/api/testing/provide-mock-payment-state.harness';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import { I18nKeys, I18nService } from '@core/i18n';
import { patchState } from '@ngrx/signals';
import type {
  PaymentFlowPort,
  ProviderDescriptor,
} from '@payments/application/api/ports/payment-store.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { StatusComponent } from '@payments/ui/pages/status/status.page';

const MOCK_DESCRIPTORS: ProviderDescriptor[] = [
  {
    id: 'stripe',
    labelKey: 'ui.provider_stripe',
    descriptionKey: 'ui.provider_stripe_description',
    icon: '💳',
  },
  {
    id: 'paypal',
    labelKey: 'ui.provider_paypal',
    descriptionKey: 'ui.provider_paypal_description',
    icon: '🅿️',
  },
];

const mockCatalog = {
  getProviderDescriptors: () => MOCK_DESCRIPTORS,
  getProviderDescriptor: (id: PaymentProviderId) =>
    MOCK_DESCRIPTORS.find((d) => d.id === id) ?? null,
  availableProviders: () => ['stripe', 'paypal'] as PaymentProviderId[],
  getSupportedMethods: () => ['card', 'spei'] as const,
  getFieldRequirements: () => null,
  buildCreatePaymentRequest: () => ({}) as any,
};

describe('StatusComponent', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;
  let mockState: PaymentFlowPort & {
    confirmPayment: ReturnType<typeof vi.fn>;
    cancelPayment: ReturnType<typeof vi.fn>;
    refreshPayment: ReturnType<typeof vi.fn>;
    selectProvider: ReturnType<typeof vi.fn>;
    intent: ReturnType<typeof signal<PaymentIntent | null>>;
    error: ReturnType<typeof signal<PaymentError | null>>;
    isLoading: ReturnType<typeof signal<boolean>>;
    selectedProvider: ReturnType<typeof signal<PaymentProviderId | null>>;
  };

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
    const baseMock = createMockPaymentState({ selectedProvider: 'stripe' });
    mockState = {
      ...baseMock,
      intent: baseMock.intent as ReturnType<typeof signal<PaymentIntent | null>>,
      error: baseMock.error as ReturnType<typeof signal<PaymentError | null>>,
      isLoading: baseMock.isLoading as ReturnType<typeof signal<boolean>>,
      selectedProvider: baseMock.selectedProvider as ReturnType<
        typeof signal<PaymentProviderId | null>
      >,
      confirmPayment: vi.fn(),
      cancelPayment: vi.fn(),
      refreshPayment: vi.fn(),
      selectProvider: vi.fn(),
    } as PaymentFlowPort & {
      confirmPayment: ReturnType<typeof vi.fn>;
      cancelPayment: ReturnType<typeof vi.fn>;
      refreshPayment: ReturnType<typeof vi.fn>;
      selectProvider: ReturnType<typeof vi.fn>;
      intent: ReturnType<typeof signal<PaymentIntent | null>>;
      error: ReturnType<typeof signal<PaymentError | null>>;
      isLoading: ReturnType<typeof signal<boolean>>;
      selectedProvider: ReturnType<typeof signal<PaymentProviderId | null>>;
    };

    await TestBed.configureTestingModule({
      imports: [StatusComponent, RouterLink],
      providers: [
        { provide: PAYMENT_STATE, useValue: mockState },
        { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
        provideRouter([]),
      ],
    }).compileComponents();

    const i18n = TestBed.inject(I18nService);
    vi.spyOn(i18n, 't').mockImplementation((key: string) => key);

    fixture = TestBed.createComponent(StatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.intentIdModel).toBe('');
      expect(component.selectedProvider()).toBe('stripe');
      expect(component.result()).toBeNull();
    });

    it('should have examples from catalog', () => {
      expect(component.examples().length).toBeGreaterThanOrEqual(1);
      expect(component.examples()[0].provider).toBeDefined();
      expect(component.examples()[0].id).toBeDefined();
    });
  });

  describe('Intent search', () => {
    it('should not search when intentId is empty', () => {
      patchState(component.statusPageState, { intentId: '' });
      component.searchIntent();
      expect(mockState.refreshPayment).not.toHaveBeenCalled();
    });

    it('should not search when intentId is only whitespace', () => {
      patchState(component.statusPageState, { intentId: '   ' });
      component.searchIntent();
      expect(mockState.refreshPayment).not.toHaveBeenCalled();
    });

    it('should search intent and call refreshPayment with providerId', () => {
      patchState(component.statusPageState, { intentId: 'pi_test_123' });
      component.searchIntent();

      expect(mockState.refreshPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });

    it('should show result when intent matches lastQueryId', () => {
      patchState(component.statusPageState, { lastQueryId: mockIntent.id });
      (mockState.intent as ReturnType<typeof signal<PaymentIntent | null>>).set(mockIntent);
      fixture.detectChanges();

      expect(component.result()).toEqual(mockIntent);
    });

    it('should not show result when intent does not match lastQueryId', () => {
      patchState(component.statusPageState, { lastQueryId: 'pi_other' });
      (mockState.intent as ReturnType<typeof signal<PaymentIntent | null>>).set(mockIntent);
      fixture.detectChanges();

      expect(component.result()).toBeNull();
    });

    it('should pass selected provider to refreshPayment', () => {
      (mockState.selectedProvider as ReturnType<typeof signal<PaymentProviderId | null>>).set(
        'paypal' as PaymentProviderId,
      );
      patchState(component.statusPageState, { intentId: 'ORDER_FAKE_XYZ' });
      component.searchIntent();

      expect(mockState.refreshPayment).toHaveBeenCalledWith(
        { intentId: 'ORDER_FAKE_XYZ' },
        'paypal',
      );
    });

    it('should trim whitespace from intentId', () => {
      patchState(component.statusPageState, { intentId: '  pi_test_123  ' });
      component.searchIntent();

      expect(mockState.refreshPayment).toHaveBeenCalledWith(
        { intentId: 'pi_test_123' },
        expect.any(String),
      );
    });
  });

  describe('Payment actions', () => {
    it('should confirm payment', () => {
      component.confirmPayment('pi_test_123');
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' });
    });

    it('should cancel payment', () => {
      component.cancelPayment('pi_test_123');
      expect(mockState.cancelPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' });
    });

    it('should refresh payment with providerId', () => {
      component.refreshPayment('pi_test_123');
      expect(mockState.refreshPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });

    it('should call confirmPayment with intentId (adapter resolves provider)', () => {
      (mockState.selectedProvider as ReturnType<typeof signal<PaymentProviderId | null>>).set(
        'paypal' as PaymentProviderId,
      );
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'ORDER_FAKE_XYZ' });
    });

    it('should call confirmPayment when next-action client_confirm is requested', () => {
      patchState(component.statusPageState, { lastQueryId: 'pi_test_123' });
      const action = { kind: 'client_confirm' as const, token: 'tok_runtime' };
      component.onNextActionRequested(action);
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' });
    });
  });

  describe('Examples', () => {
    it('should use an example and call selectProvider + searchIntent', () => {
      const example = component.examples()[0];
      component.useExample(example);
      expect(component.statusPageState.intentId()).toBe(example.id);
      expect(mockState.selectProvider).toHaveBeenCalledWith(example.provider);
      expect(mockState.refreshPayment).toHaveBeenCalledWith(
        { intentId: example.id },
        example.provider,
      );
    });
  });

  describe('Error handling', () => {
    it('should get the error message correctly', () => {
      const errorMsg = component.getErrorMessage(mockError);
      expect(errorMsg).toBe(I18nKeys.errors.provider_error);
    });

    it('should return a generic message for unknown errors', () => {
      const errorMsg = component.getErrorMessage('string error');
      expect(errorMsg).toBe(I18nKeys.errors.unknown_error);
    });

    it('should return a generic message for objects without a message', () => {
      const errorMsg = component.getErrorMessage({ code: 'unknown' });
      expect(errorMsg).toBe(I18nKeys.errors.unknown_error);
    });

    it('should expose error from payment state', () => {
      (mockState.error as ReturnType<typeof signal<PaymentError | null>>).set(mockError);
      fixture.detectChanges();
      expect(component.flowState.error()).toEqual(mockError);
    });
  });

  describe('Component state', () => {
    it('should expose isLoading from payment state', () => {
      const loadingMock = createMockPaymentState({ isLoading: true });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [StatusComponent, RouterLink],
        providers: [
          { provide: PAYMENT_STATE, useValue: loadingMock },
          { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
          provideRouter([]),
        ],
      }).compileComponents();
      const i18n = TestBed.inject(I18nService);
      vi.spyOn(i18n, 't').mockImplementation((key: string) => key);
      fixture = TestBed.createComponent(StatusComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.flowState.isLoading()).toBe(true);
    });

    it('should expose error from payment state', () => {
      (mockState.error as ReturnType<typeof signal<PaymentError | null>>).set(mockError);
      fixture.detectChanges();
      expect(component.flowState.error()).toEqual(mockError);
    });
  });
});
