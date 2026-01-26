import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { I18nKeys } from '@core/i18n';

import { ShowcaseComponent } from './showcase.page';

describe('ShowcaseComponent', () => {
  let component: ShowcaseComponent;
  let fixture: ComponentFixture<ShowcaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowcaseComponent, RouterLink],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowcaseComponent);
    component = fixture.componentInstance;
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

    it('should initialize providerSelector with default values', () => {
      expect(component.providerSelector.providers).toEqual(['stripe', 'paypal']);
      expect(component.providerSelector.selected).toBe('stripe');
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
      expect(component.paymentButton.provider).toBe('stripe');
      expect(component.paymentButton.loading).toBe(false);
      expect(component.paymentButton.disabled).toBe(false);
      expect(component.paymentButton.state).toBe('idle');
    });

    it('should initialize paymentResult with default values', () => {
      expect(component.paymentResult.showSuccess).toBe(true);
    });
  });

  describe('Sample data', () => {
    it('should have sampleIntent configured', () => {
      expect(component.sampleIntent.id).toBe('pi_fake_demo123');
      expect(component.sampleIntent.provider).toBe('stripe');
      expect(component.sampleIntent.status).toBe('succeeded');
      expect(component.sampleIntent.amount).toBe(499.99);
      expect(component.sampleIntent.currency).toBe('MXN');
    });

    it('should have sampleError configured', () => {
      expect(component.sampleError.code).toBe('card_declined');
      expect(component.sampleError.messageKey).toContain(I18nKeys.errors.card_declined);
    });

    it('should have speiInstructions configured', () => {
      expect(component.speiInstructions.clabe).toBeTruthy();
      expect(component.speiInstructions.reference).toBeTruthy();
      expect(component.speiInstructions.bank).toBe('STP');
      expect(component.speiInstructions.amount).toBe(499.99);
      expect(component.speiInstructions.currency).toBe('MXN');
    });

    it('should have intentCard configured', () => {
      expect(component.intentCard.intent.id).toBe('pi_fake_card_demo');
      expect(component.intentCard.intent.status).toBe('requires_confirmation');
      expect(component.intentCard.showActions).toBe(true);
      expect(component.intentCard.expanded).toBe(false);
    });

    it('should have fallbackModal configured', () => {
      expect(component.fallbackModal.open).toBe(false);
      expect(component.fallbackModal.event.failedProvider).toBe('stripe');
      expect(component.fallbackModal.event.alternativeProviders).toEqual(['paypal']);
    });
  });

  describe('Handlers', () => {
    it('should handle onPayClick', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      component.onPayClick();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ShowcaseComponent] Pay button clicked'),
      );
      consoleSpy.mockRestore();
    });

    it('should handle onRetry', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      component.onRetry();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ShowcaseComponent] Retry button clicked'),
      );
      consoleSpy.mockRestore();
    });

    it('should handle onNewPayment', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      component.onNewPayment();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ShowcaseComponent] New payment button clicked'),
      );
      consoleSpy.mockRestore();
    });

    it('should handle onIntentAction with parameters', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      component.onIntentAction('confirm', 'pi_test_123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ShowcaseComponent] Intent action: confirm, ID: pi_test_123'),
        { action: 'confirm', intentId: 'pi_test_123' },
      );

      consoleSpy.mockRestore();
    });

    it('should manejar onFallbackConfirm y cerrar modal', () => {
      component.fallbackModal.open = true;
      const consoleSpy = vi.spyOn(console, 'warn');
      component.onFallbackConfirm('paypal');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ShowcaseComponent] Fallback confirmed with: paypal'),
        { provider: 'paypal' },
      );
      expect(component.fallbackModal.open).toBe(false);
      consoleSpy.mockRestore();
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

    it('should tener fallbackEvent configurado correctamente', () => {
      const event = component.fallbackModal.event;
      expect(event.eventId).toBe('fb_demo_123');
      expect(event.failedProvider).toBe('stripe');
      expect(event.error.code).toBe('provider_error');
      expect(event.alternativeProviders).toEqual(['paypal']);
      expect(event.originalRequest.orderId).toBe('order_123');
    });

    it('should tener expiresAt en speiInstructions en el futuro', () => {
      const expiresAt = new Date(component.speiInstructions.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
