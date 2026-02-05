import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys } from '@core/i18n';
import { LoggerService } from '@core/logging';
import type { ProviderDescriptor } from '@payments/application/api/ports/payment-store.port';
import { SPEI_DISPLAY_CONFIG } from '@payments/application/api/tokens/spei-display-config.token';
import { ShowcaseComponent } from '@payments/ui/pages/showcase/showcase.page';

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
const loggerMock = {
  warn: vi.fn(),
  error: vi.fn(),
};

describe('ShowcaseComponent', () => {
  let component: ShowcaseComponent;
  let fixture: ComponentFixture<ShowcaseComponent>;

  beforeEach(async () => {
    loggerMock.warn.mockClear();
    loggerMock.error.mockClear();

    await TestBed.configureTestingModule({
      imports: [ShowcaseComponent, RouterLink],
      providers: [
        provideRouter([]),
        { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
        { provide: LoggerService, useValue: loggerMock },
        {
          provide: SPEI_DISPLAY_CONFIG,
          useValue: {
            receivingBanks: { STP: 'STP (Transfers and Payments System)' },
            beneficiaryName: 'Payment Service',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowcaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize orderSummary with default values', () => {
      expect(component.orderSummary.orderId).toBe('order_demo_123');
      expect(component.orderSummary.amount).toBe(499.99);
      expect(component.orderSummary.currency).toBe('MXN');
      expect(component.orderSummary.showItems).toBe(true);
      expect(component.orderSummary.items.length).toBe(2);
    });

    it('should initialize providerSelector from catalog', () => {
      expect(component.providerDescriptors().map((d) => d.id)).toContain(
        component.providerSelector.selected ?? component.catalogProviderIds().p0,
      );
      expect(component.providerSelector.disabled).toBe(false);
    });

    it('should initialize methodSelector with default values', () => {
      expect(component.methodSelector.methods).toEqual(['card', 'spei']);
      expect(component.methodSelector.selected).toBe('card');
      expect(component.methodSelector.disabled).toBe(false);
    });

    it('should initialize paymentButton with default values', () => {
      expect(component.paymentButton.amount).toBe(499.99);
      expect(component.paymentButton.currency).toBe('MXN');
      expect(component.paymentButton.provider ?? component.catalogProviderIds().p0).toBeDefined();
      expect(component.paymentButton.loading).toBe(false);
      expect(component.paymentButton.disabled).toBe(false);
      expect(component.paymentButton.state).toBe('idle');
    });

    it('should initialize paymentResult with default values', () => {
      expect(component.paymentResult.showSuccess).toBe(true);
    });
  });

  describe('Sample data', () => {
    it('should have sampleIntent configured from catalog', () => {
      const intent = component.sampleIntent();
      expect(intent).toBeTruthy();
      expect(intent?.id?.value ?? intent?.id).toBe('pi_fake_demo123');
      expect(intent?.provider).toBe(component.catalogProviderIds().p0);
      expect(intent?.status).toBe('succeeded');
      expect(intent?.money.amount).toBe(499.99);
      expect(intent?.money.currency).toBe('MXN');
    });

    it('should have sampleError configured', () => {
      expect(component.sampleError.code).toBe('card_declined');
      expect(component.sampleError.messageKey).toContain(I18nKeys.errors.card_declined);
    });

    it('should have speiInstructions configured', () => {
      expect(component.speiInstructions.clabe).toBeTruthy();
      expect(component.speiInstructions.reference).toBeTruthy();
      expect(component.speiInstructions.bankCode).toBe('STP');
      expect(component.speiInstructions.amount).toBe(499.99);
      expect(component.speiInstructions.currency).toBe('MXN');
    });

    it('should have intentCard configured from catalog when providers exist', () => {
      expect(component.providerDescriptors().length).toBeGreaterThan(0);
      const card = component.intentCard();
      expect(card.intent).not.toBeNull();
      if (card.intent) {
        expect(card.intent.id?.value ?? card.intent.id).toBe('pi_fake_card_demo');
        expect(card.intent.status).toBe('requires_confirmation');
        expect(card.intent.provider).toBe(component.catalogProviderIds().p0);
      }
      expect(card.showActions).toBe(true);
      expect(card.expanded).toBe(false);
    });

    it('should have fallbackModal event from catalog when providers exist', () => {
      expect(component.fallbackModalOpen).toBe(false);
      expect(component.providerDescriptors().length).toBeGreaterThan(0);
      const event = component.fallbackModalEvent();
      expect(event).not.toBeNull();
      if (event) {
        expect(event.failedProvider).toBe(component.catalogProviderIds().p0);
        expect(Array.isArray(event.alternativeProviders)).toBe(true);
      }
    });
  });

  describe('Handlers', () => {
    it('should handle onPayClick', () => {
      component.onPayClick();
      expect(loggerMock.warn).toHaveBeenCalledWith('Pay button clicked', 'ShowcaseComponent');
    });

    it('should handle onRetry', () => {
      component.onRetry();
      expect(loggerMock.warn).toHaveBeenCalledWith('Retry button clicked', 'ShowcaseComponent');
    });

    it('should handle onNewPayment', () => {
      component.onNewPayment();
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'New payment button clicked',
        'ShowcaseComponent',
      );
    });

    it('should handle onIntentAction with parameters', () => {
      component.onIntentAction('confirm', 'pi_test_123');

      expect(loggerMock.warn).toHaveBeenCalledWith(
        'Intent action: confirm, ID: pi_test_123',
        'ShowcaseComponent',
        { action: 'confirm', intentId: 'pi_test_123' },
      );
    });

    it('should handle onFallbackConfirm and close modal', () => {
      component.fallbackModalOpen = true;
      const altProvider = component.catalogProviderIds().p1 ?? component.catalogProviderIds().p0;
      component.onFallbackConfirm(altProvider);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        `Fallback confirmed with: ${altProvider}`,
        'ShowcaseComponent',
        { provider: altProvider },
      );
      expect(component.fallbackModalOpen).toBe(false);
    });
  });

  describe('Estructura de datos', () => {
    it('should tener items en orderSummary', () => {
      expect(component.orderSummary.items.length).toBe(2);
      expect(component.orderSummary.items[0].name).toBe('Premium product');
      expect(component.orderSummary.items[0].price).toBe(399.99);
      expect(component.orderSummary.items[1].name).toBe('Express shipping');
      expect(component.orderSummary.items[1].price).toBe(100.0);
    });

    it('should have fallbackEvent configured from catalog when providers exist', () => {
      expect(component.providerDescriptors().length).toBeGreaterThan(0);
      const event = component.fallbackModalEvent();
      expect(event).not.toBeNull();
      if (event) {
        expect(event.eventId).toBe('fb_demo_123');
        expect(event.failedProvider).toBe(component.catalogProviderIds().p0);
        expect(event.error.code).toBe('provider_error');
        expect(event.alternativeProviders).toEqual(
          component.catalogProviderIds().p1 ? [component.catalogProviderIds().p1] : [],
        );
        expect(event.originalRequest.orderId.value).toBe('order_123');
      }
    });

    it('should tener expiresAt en speiInstructions en el futuro', () => {
      const expiresAt = new Date(component.speiInstructions.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
