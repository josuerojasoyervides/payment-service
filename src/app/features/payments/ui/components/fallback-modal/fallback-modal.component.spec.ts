import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import type { FallbackAvailableEvent } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-event.model';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys, I18nService } from '@core/i18n';
import type { ProviderDescriptor } from '@payments/application/api/ports/payment-store.port';
import { FallbackModalComponent } from '@payments/ui/components/fallback-modal/fallback-modal.component';

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

describe('FallbackModalComponent', () => {
  let component: FallbackModalComponent;
  let fixture: ComponentFixture<FallbackModalComponent>;
  let mockI18n: any;

  const mockError: PaymentError = {
    code: 'provider_error',
    messageKey: I18nKeys.errors.provider_error,
    raw: { error: 'test' },
  };

  const mockEvent1: FallbackAvailableEvent = {
    eventId: 'event_1',
    failedProvider: 'stripe',
    error: mockError,
    alternativeProviders: ['paypal'],
    originalRequest: {
      orderId: 'order_1',
      amount: 100,
      currency: 'MXN',
      method: { type: 'card', token: 'tok_test' },
    },
    timestamp: Date.now(),
  };

  const mockEvent2: FallbackAvailableEvent = {
    eventId: 'event_2',
    failedProvider: 'paypal',
    error: mockError,
    alternativeProviders: ['stripe'],
    originalRequest: {
      orderId: 'order_2',
      amount: 200,
      currency: 'MXN',
      method: { type: 'card', token: 'tok_test' },
    },
    timestamp: Date.now(),
  };

  beforeEach(async () => {
    mockI18n = {
      t: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
      getLanguage: vi.fn(() => 'es'),
      has: vi.fn(() => true),
      currentLang: { asReadonly: vi.fn() } as any,
    };

    await TestBed.configureTestingModule({
      imports: [FallbackModalComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FallbackModalComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with selectedProvider null', () => {
      expect(component.selectedProvider()).toBeNull();
    });
  });

  describe('Provider selection', () => {
    it('should select a provider', () => {
      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');
    });

    it('should change selection', () => {
      component.selectProvider('paypal');
      component.selectProvider('stripe');
      expect(component.selectedProvider()).toBe('stripe');
    });
  });

  describe('Reset selectedProvider', () => {
    it('should reset selectedProvider when open changes to false', () => {
      // Open modal and select a provider
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();

      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');

      // Simulate modal closing
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();

      // Should be reset
      expect(component.selectedProvider()).toBeNull();
    });

    it('should reset selectedProvider when eventId changes', () => {
      // Set first event
      fixture.componentRef.setInput('event', mockEvent1);
      fixture.detectChanges();

      // Select a provider
      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');

      // Switch to a new event with a different eventId
      fixture.componentRef.setInput('event', mockEvent2);
      fixture.detectChanges();

      // Should be reset
      expect(component.selectedProvider()).toBeNull();
    });

    it('should not reset selectedProvider when eventId is the same', () => {
      // Set event
      fixture.componentRef.setInput('event', mockEvent1);
      fixture.detectChanges();

      // Select a provider
      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');

      // Update the same event (same eventId, different content)
      const sameEventId = { ...mockEvent1, timestamp: Date.now() };
      fixture.componentRef.setInput('event', sameEventId);
      fixture.detectChanges();

      // Should not be reset (same eventId)
      expect(component.selectedProvider()).toBe('paypal');
    });
  });

  describe('Confirm and Cancel', () => {
    it('should emit confirm with selected provider', () => {
      const spy = vi.fn();
      component.confirm.subscribe(spy);

      component.selectProvider('paypal');
      component.onConfirm();

      expect(spy).toHaveBeenCalledWith('paypal');
      expect(component.selectedProvider()).toBeNull();
    });

    it('should emit cancel', () => {
      const spy = vi.fn();
      component.canceled.subscribe(spy);

      component.selectProvider('paypal');
      component.onCancel();

      expect(spy).toHaveBeenCalled();
      expect(component.selectedProvider()).toBeNull();
    });

    it('should not emit confirm when no provider is selected', () => {
      const spy = vi.fn();
      component.confirm.subscribe(spy);

      component.onConfirm();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Computed properties', () => {
    it('should compute errorMessage correctly', () => {
      fixture.componentRef.setInput('event', mockEvent1);
      fixture.detectChanges();

      expect(component.errorMessageText()).toBe(I18nKeys.errors.provider_error);
    });

    it('should return null when there is no error', () => {
      const eventWithoutError = { ...mockEvent1, error: null };
      fixture.componentRef.setInput('event', eventWithoutError);
      fixture.detectChanges();

      expect(component.errorMessageText()).toBe(I18nKeys.errors.unknown_error);
    });

    it('should compute alternativeProviders correctly', () => {
      fixture.componentRef.setInput('event', mockEvent1);
      fixture.detectChanges();

      const providers = component.alternativeProviders();
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.some((p) => p.id === 'paypal')).toBe(true);
    });

    it('should compute selectedProviderName correctly', () => {
      component.selectProvider('paypal');
      const name = component.selectedProviderName();
      expect(name).toBeTruthy();
    });

    it('should retornar null si no hay provider seleccionado', () => {
      expect(component.selectedProviderName()).toBeNull();
    });
  });
});
