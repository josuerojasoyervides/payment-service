import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys, I18nService } from '@core/i18n';
import type { FallbackConfirmationData } from '@payments/application/api/contracts/resilience.types';
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

  const mockData1: FallbackConfirmationData = {
    eligibleProviders: ['paypal'],
    failureReason: 'provider_error',
    timeoutMs: 30_000,
  };

  const mockData2: FallbackConfirmationData = {
    eligibleProviders: ['stripe'],
    failureReason: 'provider_error',
    timeoutMs: 30_000,
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

    it('should reset selectedProvider when data changes', () => {
      // Set first data
      fixture.componentRef.setInput('data', mockData1);
      fixture.detectChanges();

      // Select a provider
      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');

      // Switch to new data with a different provider list
      fixture.componentRef.setInput('data', mockData2);
      fixture.detectChanges();

      // Should be reset
      expect(component.selectedProvider()).toBeNull();
    });

    it('should not reset selectedProvider when data key is the same', () => {
      // Set data
      fixture.componentRef.setInput('data', mockData1);
      fixture.detectChanges();

      // Select a provider
      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');

      // Update with the same data
      const sameData = { ...mockData1 };
      fixture.componentRef.setInput('data', sameData);
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
      fixture.componentRef.setInput('data', mockData1);
      fixture.detectChanges();

      expect(component.errorMessageText()).toBe(I18nKeys.errors.provider_error);
    });

    it('should return null when there is no error', () => {
      fixture.componentRef.setInput('data', null);
      fixture.detectChanges();

      expect(component.errorMessageText()).toBe(I18nKeys.errors.unknown_error);
    });

    it('should compute alternativeProviders correctly', () => {
      fixture.componentRef.setInput('data', mockData1);
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
