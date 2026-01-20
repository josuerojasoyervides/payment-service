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
    template: `
        <div class="min-h-screen bg-gray-100 py-8">
            <div class="max-w-6xl mx-auto px-4">
                <!-- Header -->
                <div class="text-center mb-12">
                    <h1 class="text-3xl font-bold text-gray-900">Component Showcase</h1>
                    <p class="text-gray-600 mt-2">
                        Galería interactiva de componentes de pago reutilizables
                    </p>
                    <div class="flex justify-center gap-4 mt-4 text-sm">
                        <a routerLink="/payments/checkout" class="text-blue-600 hover:underline">
                            Ir al Checkout
                        </a>
                    </div>
                </div>

                <!-- Components Grid -->
                <div class="space-y-12">
                    
                    <!-- Order Summary -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">OrderSummaryComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                <app-order-summary
                                    [orderId]="orderSummary.orderId"
                                    [amount]="orderSummary.amount"
                                    [currency]="orderSummary.currency"
                                    [items]="orderSummary.showItems ? orderSummary.items : undefined"
                                />
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Controls</h3>
                                <div class="space-y-3 text-sm">
                                    <div>
                                        <label class="label">Amount</label>
                                        <input type="number" class="input" [(ngModel)]="orderSummary.amount" />
                                    </div>
                                    <div>
                                        <label class="label">Currency</label>
                                        <select class="input" [(ngModel)]="orderSummary.currency">
                                            <option value="MXN">MXN</option>
                                            <option value="USD">USD</option>
                                        </select>
                                    </div>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" [(ngModel)]="orderSummary.showItems" />
                                        Show items breakdown
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Provider Selector -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">ProviderSelectorComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                <app-provider-selector
                                    [providers]="providerSelector.providers"
                                    [selected]="providerSelector.selected"
                                    [disabled]="providerSelector.disabled"
                                    (providerChange)="providerSelector.selected = $event"
                                />
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Controls</h3>
                                <div class="space-y-3 text-sm">
                                    <p>Selected: <code class="bg-gray-100 px-2 py-1 rounded">{{ providerSelector.selected }}</code></p>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" [(ngModel)]="providerSelector.disabled" />
                                        Disabled
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Method Selector -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">MethodSelectorComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                <app-method-selector
                                    [methods]="methodSelector.methods"
                                    [selected]="methodSelector.selected"
                                    [disabled]="methodSelector.disabled"
                                    (methodChange)="methodSelector.selected = $event"
                                />
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Controls</h3>
                                <div class="space-y-3 text-sm">
                                    <p>Selected: <code class="bg-gray-100 px-2 py-1 rounded">{{ methodSelector.selected }}</code></p>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" [(ngModel)]="methodSelector.disabled" />
                                        Disabled
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Payment Button -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">PaymentButtonComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                <app-payment-button
                                    [amount]="paymentButton.amount"
                                    [currency]="paymentButton.currency"
                                    [provider]="paymentButton.provider"
                                    [loading]="paymentButton.loading"
                                    [disabled]="paymentButton.disabled"
                                    [buttonState]="paymentButton.state"
                                    (pay)="onPayClick()"
                                />
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Controls</h3>
                                <div class="space-y-3 text-sm">
                                    <div>
                                        <label class="label">Provider</label>
                                        <select class="input" [(ngModel)]="paymentButton.provider">
                                            <option value="stripe">Stripe</option>
                                            <option value="paypal">PayPal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="label">State</label>
                                        <select class="input" [(ngModel)]="paymentButton.state">
                                            <option value="idle">Idle</option>
                                            <option value="loading">Loading</option>
                                            <option value="success">Success</option>
                                            <option value="error">Error</option>
                                        </select>
                                    </div>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" [(ngModel)]="paymentButton.disabled" />
                                        Disabled
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Payment Result -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">PaymentResultComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                @if (paymentResult.showSuccess) {
                                    <app-payment-result
                                        [intent]="sampleIntent"
                                        [error]="null"
                                        (retry)="onRetry()"
                                        (newPayment)="onNewPayment()"
                                    />
                                } @else {
                                    <app-payment-result
                                        [intent]="null"
                                        [error]="sampleError"
                                        (retry)="onRetry()"
                                        (newPayment)="onNewPayment()"
                                    />
                                }
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Controls</h3>
                                <div class="space-y-3 text-sm">
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" [(ngModel)]="paymentResult.showSuccess" />
                                        Show success state
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- SPEI Instructions -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">SpeiInstructionsComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                <app-spei-instructions
                                    [clabe]="speiInstructions.clabe"
                                    [reference]="speiInstructions.reference"
                                    [bank]="speiInstructions.bank"
                                    [beneficiary]="speiInstructions.beneficiary"
                                    [amount]="speiInstructions.amount"
                                    [currency]="speiInstructions.currency"
                                    [expiresAt]="speiInstructions.expiresAt"
                                />
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Controls</h3>
                                <div class="space-y-3 text-sm">
                                    <div>
                                        <label class="label">Amount</label>
                                        <input type="number" class="input" [(ngModel)]="speiInstructions.amount" />
                                    </div>
                                    <div>
                                        <label class="label">CLABE</label>
                                        <input type="text" class="input font-mono" [(ngModel)]="speiInstructions.clabe" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Payment Intent Card -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">PaymentIntentCardComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                <app-payment-intent-card
                                    [intent]="intentCard.intent"
                                    [showActions]="intentCard.showActions"
                                    [expanded]="intentCard.expanded"
                                    (confirm)="onIntentAction('confirm', $event)"
                                    (cancel)="onIntentAction('cancel', $event)"
                                    (refresh)="onIntentAction('refresh', $event)"
                                />
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Controls</h3>
                                <div class="space-y-3 text-sm">
                                    <div>
                                        <label class="label">Status</label>
                                        <select class="input" [(ngModel)]="intentCard.intent.status">
                                            <option value="requires_confirmation">Requires Confirmation</option>
                                            <option value="requires_action">Requires Action</option>
                                            <option value="processing">Processing</option>
                                            <option value="succeeded">Succeeded</option>
                                            <option value="failed">Failed</option>
                                            <option value="canceled">Canceled</option>
                                        </select>
                                    </div>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" [(ngModel)]="intentCard.showActions" />
                                        Show actions
                                    </label>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" [(ngModel)]="intentCard.expanded" />
                                        Expanded
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- Fallback Modal -->
                    <section class="card">
                        <h2 class="text-xl font-bold mb-4 pb-4 border-b">FallbackModalComponent</h2>
                        <div class="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 class="font-medium mb-3">Preview</h3>
                                <button class="btn-primary" (click)="fallbackModal.open = true">
                                    Open Fallback Modal
                                </button>
                                <app-fallback-modal
                                    [event]="fallbackModal.event"
                                    [open]="fallbackModal.open"
                                    (confirm)="onFallbackConfirm($event)"
                                    (cancel)="fallbackModal.open = false"
                                />
                            </div>
                            <div>
                                <h3 class="font-medium mb-3">Info</h3>
                                <p class="text-sm text-gray-600">
                                    Este modal aparece cuando un proveedor falla y hay alternativas disponibles.
                                    Permite al usuario seleccionar otro proveedor para reintentar el pago.
                                </p>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    `,
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
