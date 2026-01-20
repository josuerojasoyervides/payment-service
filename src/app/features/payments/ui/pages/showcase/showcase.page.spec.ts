import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterLink, provideRouter } from '@angular/router';
import { ShowcaseComponent } from './showcase.page';
import { PaymentProviderId, PaymentMethodType, CurrencyCode, FallbackAvailableEvent } from '../../../domain/models';

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

    describe('Inicialización', () => {
        it('debe crear el componente', () => {
            expect(component).toBeTruthy();
        });

        it('debe inicializar orderSummary con valores por defecto', () => {
            expect(component.orderSummary.orderId).toBe('order_demo_123');
            expect(component.orderSummary.amount).toBe(499.99);
            expect(component.orderSummary.currency).toBe('MXN');
            expect(component.orderSummary.showItems).toBe(true);
            expect(component.orderSummary.items.length).toBe(2);
        });

        it('debe inicializar providerSelector con valores por defecto', () => {
            expect(component.providerSelector.providers).toEqual(['stripe', 'paypal']);
            expect(component.providerSelector.selected).toBe('stripe');
            expect(component.providerSelector.disabled).toBe(false);
        });

        it('debe inicializar methodSelector con valores por defecto', () => {
            expect(component.methodSelector.methods).toEqual(['card', 'spei']);
            expect(component.methodSelector.selected).toBe('card');
            expect(component.methodSelector.disabled).toBe(false);
        });

        it('debe inicializar paymentButton con valores por defecto', () => {
            expect(component.paymentButton.amount).toBe(499.99);
            expect(component.paymentButton.currency).toBe('MXN');
            expect(component.paymentButton.provider).toBe('stripe');
            expect(component.paymentButton.loading).toBe(false);
            expect(component.paymentButton.disabled).toBe(false);
            expect(component.paymentButton.state).toBe('idle');
        });

        it('debe inicializar paymentResult con valores por defecto', () => {
            expect(component.paymentResult.showSuccess).toBe(true);
        });
    });

    describe('Datos de ejemplo', () => {
        it('debe tener sampleIntent configurado', () => {
            expect(component.sampleIntent.id).toBe('pi_fake_demo123');
            expect(component.sampleIntent.provider).toBe('stripe');
            expect(component.sampleIntent.status).toBe('succeeded');
            expect(component.sampleIntent.amount).toBe(499.99);
            expect(component.sampleIntent.currency).toBe('MXN');
        });

        it('debe tener sampleError configurado', () => {
            expect(component.sampleError.code).toBe('card_declined');
            expect(component.sampleError.message).toContain('rechazada');
        });

        it('debe tener speiInstructions configurado', () => {
            expect(component.speiInstructions.clabe).toBeTruthy();
            expect(component.speiInstructions.reference).toBeTruthy();
            expect(component.speiInstructions.bank).toBe('STP');
            expect(component.speiInstructions.amount).toBe(499.99);
            expect(component.speiInstructions.currency).toBe('MXN');
        });

        it('debe tener intentCard configurado', () => {
            expect(component.intentCard.intent.id).toBe('pi_fake_card_demo');
            expect(component.intentCard.intent.status).toBe('requires_confirmation');
            expect(component.intentCard.showActions).toBe(true);
            expect(component.intentCard.expanded).toBe(false);
        });

        it('debe tener fallbackModal configurado', () => {
            expect(component.fallbackModal.open).toBe(false);
            expect(component.fallbackModal.event.failedProvider).toBe('stripe');
            expect(component.fallbackModal.event.alternativeProviders).toEqual(['paypal']);
        });
    });

    describe('Handlers', () => {
        it('debe manejar onPayClick', () => {
            const consoleSpy = vi.spyOn(console, 'log');
            component.onPayClick();
            expect(consoleSpy).toHaveBeenCalledWith('[Showcase] Pay button clicked');
            consoleSpy.mockRestore();
        });

        it('debe manejar onRetry', () => {
            const consoleSpy = vi.spyOn(console, 'log');
            component.onRetry();
            expect(consoleSpy).toHaveBeenCalledWith('[Showcase] Retry clicked');
            consoleSpy.mockRestore();
        });

        it('debe manejar onNewPayment', () => {
            const consoleSpy = vi.spyOn(console, 'log');
            component.onNewPayment();
            expect(consoleSpy).toHaveBeenCalledWith('[Showcase] New payment clicked');
            consoleSpy.mockRestore();
        });

        it('debe manejar onIntentAction con parámetros', () => {
            const consoleSpy = vi.spyOn(console, 'log');
            component.onIntentAction('confirm', 'pi_test_123');
            expect(consoleSpy).toHaveBeenCalledWith('[Showcase] Intent action: confirm, ID: pi_test_123');
            consoleSpy.mockRestore();
        });

        it('debe manejar onFallbackConfirm y cerrar modal', () => {
            component.fallbackModal.open = true;
            const consoleSpy = vi.spyOn(console, 'log');
            component.onFallbackConfirm('paypal');
            expect(consoleSpy).toHaveBeenCalledWith('[Showcase] Fallback confirmed with: paypal');
            expect(component.fallbackModal.open).toBe(false);
            consoleSpy.mockRestore();
        });
    });

    describe('Estructura de datos', () => {
        it('debe tener items en orderSummary', () => {
            expect(component.orderSummary.items.length).toBe(2);
            expect(component.orderSummary.items[0].name).toBe('Producto Premium');
            expect(component.orderSummary.items[0].price).toBe(399.99);
            expect(component.orderSummary.items[1].name).toBe('Envío express');
            expect(component.orderSummary.items[1].price).toBe(100.00);
        });

        it('debe tener fallbackEvent configurado correctamente', () => {
            const event = component.fallbackModal.event;
            expect(event.eventId).toBe('fb_demo_123');
            expect(event.failedProvider).toBe('stripe');
            expect(event.error.code).toBe('provider_error');
            expect(event.alternativeProviders).toEqual(['paypal']);
            expect(event.originalRequest.orderId).toBe('order_123');
        });

        it('debe tener expiresAt en speiInstructions en el futuro', () => {
            const expiresAt = new Date(component.speiInstructions.expiresAt);
            const now = new Date();
            expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
        });
    });
});
