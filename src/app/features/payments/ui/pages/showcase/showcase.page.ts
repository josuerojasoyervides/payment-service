import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
    PaymentIntent,
    PaymentProviderId,
    PaymentMethodType,
    CurrencyCode,
    FallbackAvailableEvent,
    PaymentError,
} from '../../../domain/models';
import { FieldRequirements } from '../../../domain/ports';
import {
    OrderSummaryComponent,
    ProviderSelectorComponent,
    MethodSelectorComponent,
    PaymentButtonComponent,
    PaymentResultComponent,
    SpeiInstructionsComponent,
    FallbackModalComponent,
    PaymentIntentCardComponent,
} from '../../components';
import { OrderItem, PaymentButtonState } from '../../shared';

/**
 * Página de showcase para demostrar todos los componentes de UI.
 * 
 * Permite ver cada componente en diferentes estados y configuraciones,
 * con controles interactivos para modificar sus props.
 */
@Component({
    selector: 'app-showcase',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        OrderSummaryComponent,
        ProviderSelectorComponent,
        MethodSelectorComponent,
        PaymentButtonComponent,
        PaymentResultComponent,
        SpeiInstructionsComponent,
        FallbackModalComponent,
        PaymentIntentCardComponent,
    ],
    templateUrl: './showcase.component.html',
})
export class ShowcaseComponent {
    // Order Summary state
    orderSummary = {
        orderId: 'order_demo_123',
        amount: 499.99,
        currency: 'MXN' as CurrencyCode,
        showItems: true,
        items: [
            { name: 'Producto Premium', quantity: 1, price: 399.99 },
            { name: 'Envío express', quantity: 1, price: 100.00 },
        ] as OrderItem[],
    };

    // Provider Selector state
    providerSelector = {
        providers: ['stripe', 'paypal'] as PaymentProviderId[],
        selected: 'stripe' as PaymentProviderId,
        disabled: false,
    };

    // Method Selector state
    methodSelector = {
        methods: ['card', 'spei'] as PaymentMethodType[],
        selected: 'card' as PaymentMethodType,
        disabled: false,
    };

    // Payment Button state
    paymentButton = {
        amount: 499.99,
        currency: 'MXN' as CurrencyCode,
        provider: 'stripe' as PaymentProviderId,
        loading: false,
        disabled: false,
        state: 'idle' as PaymentButtonState,
    };

    // Payment Result state
    paymentResult = {
        showSuccess: true,
    };

    // Sample data
    sampleIntent: PaymentIntent = {
        id: 'pi_fake_demo123',
        provider: 'stripe',
        status: 'succeeded',
        amount: 499.99,
        currency: 'MXN',
        clientSecret: 'pi_fake_demo123_secret_xxx',
    };

    sampleError: PaymentError = {
        code: 'card_declined',
        message: 'La tarjeta fue rechazada. Por favor intenta con otro método de pago.',
        raw: { originalError: 'card_declined' },
    };

    // SPEI Instructions state
    speiInstructions = {
        clabe: '646180157034567890',
        reference: '1234567',
        bank: 'STP',
        beneficiary: 'Payment Service Demo',
        amount: 499.99,
        currency: 'MXN',
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    };

    // Intent Card state
    intentCard = {
        intent: {
            id: 'pi_fake_card_demo',
            provider: 'stripe' as PaymentProviderId,
            status: 'requires_confirmation' as const,
            amount: 299.99,
            currency: 'MXN' as CurrencyCode,
        } as PaymentIntent,
        showActions: true,
        expanded: false,
    };

    // Fallback Modal state
    fallbackModal = {
        open: false,
        event: {
            failedProvider: 'stripe',
            error: { code: 'provider_error', message: 'Stripe está temporalmente no disponible' },
            alternativeProviders: ['paypal'],
            originalRequest: {
                orderId: 'order_123',
                amount: 499.99,
                currency: 'MXN',
                method: { type: 'card', token: 'tok_xxx' },
            },
            timestamp: Date.now(),
            eventId: 'fb_demo_123',
        } as FallbackAvailableEvent,
    };

    // Handlers
    onPayClick(): void {
        console.log('[Showcase] Pay button clicked');
    }

    onRetry(): void {
        console.log('[Showcase] Retry clicked');
    }

    onNewPayment(): void {
        console.log('[Showcase] New payment clicked');
    }

    onIntentAction(action: string, intentId: string): void {
        console.log(`[Showcase] Intent action: ${action}, ID: ${intentId}`);
    }

    onFallbackConfirm(provider: PaymentProviderId): void {
        console.log(`[Showcase] Fallback confirmed with: ${provider}`);
        this.fallbackModal.open = false;
    }
}
