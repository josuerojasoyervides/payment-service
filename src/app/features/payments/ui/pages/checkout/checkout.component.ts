import { Component, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

// Port y token (desacoplado de implementación)
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import { LoggerService } from '@core/logging';

// Domain types
import { PaymentProviderId, PaymentMethodType, CurrencyCode } from '../../../domain/models';
import { FieldRequirements, PaymentOptions } from '../../../domain/ports';

// UI Components
import {
    OrderSummaryComponent,
    ProviderSelectorComponent,
    MethodSelectorComponent,
    PaymentFormComponent,
    PaymentButtonComponent,
    PaymentResultComponent,
    NextActionCardComponent,
    FallbackModalComponent,
} from '../../components';

/**
 * Página de checkout para procesar pagos.
 * 
 * Esta página compone los componentes reutilizables para crear
 * el flujo completo de checkout:
 * 1. Resumen de orden
 * 2. Selección de proveedor
 * 3. Selección de método de pago
 * 4. Formulario dinámico
 * 5. Botón de pago
 * 6. Resultado (éxito/error)
 */
@Component({
    selector: 'app-checkout',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        OrderSummaryComponent,
        ProviderSelectorComponent,
        MethodSelectorComponent,
        PaymentFormComponent,
        PaymentButtonComponent,
        PaymentResultComponent,
        NextActionCardComponent,
        FallbackModalComponent,
    ],
    template: `
        <div class="min-h-screen bg-gray-50 py-8">
            <div class="max-w-2xl mx-auto px-4">
                <!-- Header -->
                <div class="text-center mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">Checkout</h1>
                    <p class="text-gray-600 mt-2">Sistema de pagos con arquitectura empresarial</p>
                    
                    <!-- Navigation -->
                    <div class="flex justify-center gap-4 mt-4 text-sm">
                        <a routerLink="/payments/history" class="text-blue-600 hover:underline">
                            Ver historial
                        </a>
                        <a routerLink="/payments/status" class="text-blue-600 hover:underline">
                            Consultar estado
                        </a>
                        <a routerLink="/payments/showcase" class="text-blue-600 hover:underline">
                            Showcase
                        </a>
                    </div>
                </div>

                <!-- Mostrar resultado si hay éxito o error -->
                @if (showResult()) {
                    <div class="mb-6">
                        <app-payment-result
                            [intent]="currentIntent()"
                            [error]="currentError()"
                            (retry)="resetPayment()"
                            (newPayment)="resetPayment()"
                        />

                        <!-- Next Action si existe -->
                        @if (currentIntent()?.nextAction) {
                            <app-next-action-card
                                [nextAction]="currentIntent()!.nextAction!"
                            />
                        }
                    </div>
                } @else {
                    <!-- Flujo de checkout -->
                    <div class="space-y-6">
                        <!-- Order Summary -->
                        <app-order-summary
                            [orderId]="orderId()"
                            [amount]="amount()"
                            [currency]="currency()"
                        />

                        <!-- Step 1: Provider Selection -->
                        <div class="card">
                            <div class="flex items-center gap-3 mb-4">
                                <span class="step-number">1</span>
                                <h2 class="text-lg font-semibold">Proveedor de pago</h2>
                            </div>
                            <app-provider-selector
                                [providers]="availableProviders()"
                                [selected]="selectedProvider()"
                                [disabled]="isLoading()"
                                (providerChange)="selectProvider($event)"
                            />
                        </div>

                        <!-- Step 2: Method Selection -->
                        <div class="card">
                            <div class="flex items-center gap-3 mb-4">
                                <span [class]="selectedProvider() ? 'step-number' : 'step-number-inactive'">2</span>
                                <h2 class="text-lg font-semibold">Método de pago</h2>
                            </div>
                            <app-method-selector
                                [methods]="availableMethods()"
                                [selected]="selectedMethod()"
                                [disabled]="isLoading() || !selectedProvider()"
                                (methodChange)="selectMethod($event)"
                            />
                        </div>

                        <!-- Step 3: Payment Form -->
                        @if (selectedMethod()) {
                            <div class="card">
                                <div class="flex items-center gap-3 mb-4">
                                    <span class="step-number">3</span>
                                    <h2 class="text-lg font-semibold">Datos de pago</h2>
                                </div>
                                <app-payment-form
                                    [requirements]="fieldRequirements()"
                                    [disabled]="isLoading()"
                                    (formChange)="onFormChange($event)"
                                    (formValidChange)="onFormValidChange($event)"
                                />
                            </div>
                        }

                        <!-- Payment Button -->
                        @if (selectedProvider() && selectedMethod()) {
                            <app-payment-button
                                [amount]="amount()"
                                [currency]="currency()"
                                [provider]="selectedProvider()"
                                [loading]="isLoading()"
                                [disabled]="!isFormValid()"
                                (pay)="processPayment()"
                            />
                        }
                    </div>
                }

                <!-- Debug Section (solo en desarrollo) -->
                @if (isDevMode) {
                    <div class="mt-8 p-4 bg-gray-100 rounded-lg">
                        <details>
                            <summary class="cursor-pointer text-sm text-gray-600 font-medium">
                                🔍 Debug Info
                            </summary>
                            <div class="mt-4 space-y-2 text-xs font-mono">
                                <p><strong>Provider:</strong> {{ selectedProvider() }}</p>
                                <p><strong>Method:</strong> {{ selectedMethod() }}</p>
                                <p><strong>Form Valid:</strong> {{ isFormValid() }}</p>
                                <p><strong>Loading:</strong> {{ isLoading() }}</p>
                                <pre class="bg-white p-2 rounded mt-2 overflow-auto">{{ debugInfo() | json }}</pre>
                            </div>
                        </details>
                    </div>
                }

                <!-- Fallback Modal -->
                <app-fallback-modal
                    [event]="pendingFallbackEvent()"
                    [open]="hasPendingFallback()"
                    (confirm)="confirmFallback($event)"
                    (cancel)="cancelFallback()"
                />
            </div>
        </div>
    `,
})
export class CheckoutComponent {
    readonly isDevMode = isDevMode();
    
    // Servicios
    private readonly paymentState = inject(PAYMENT_STATE);
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly logger = inject(LoggerService);

    // === Datos de la orden (simulados) ===
    readonly orderId = signal('order_' + Math.random().toString(36).substring(7));
    readonly amount = signal(499.99);
    readonly currency = signal<CurrencyCode>('MXN');

    // === Selección del usuario ===
    readonly selectedProvider = signal<PaymentProviderId | null>(null);
    readonly selectedMethod = signal<PaymentMethodType | null>(null);

    // === Estado del formulario ===
    private formOptions = signal<PaymentOptions>({});
    readonly isFormValid = signal(false);

    // === Estado del store (vía port) ===
    readonly isLoading = this.paymentState.isLoading;
    readonly isReady = this.paymentState.isReady;
    readonly hasError = this.paymentState.hasError;
    readonly currentIntent = this.paymentState.intent;
    readonly currentError = this.paymentState.error;

    // === Estado del fallback ===
    readonly hasPendingFallback = this.paymentState.hasPendingFallback;
    readonly pendingFallbackEvent = this.paymentState.pendingFallbackEvent;

    // === Providers disponibles ===
    readonly availableProviders = computed<PaymentProviderId[]>(() => {
        return this.registry.getAvailableProviders();
    });

    // === Métodos disponibles para el provider seleccionado ===
    readonly availableMethods = computed<PaymentMethodType[]>(() => {
        const provider = this.selectedProvider();
        if (!provider) return [];
        try {
            const factory = this.registry.get(provider);
            return factory.getSupportedMethods();
        } catch {
            return [];
        }
    });

    // === Requisitos de campos ===
    readonly fieldRequirements = computed<FieldRequirements | null>(() => {
        const provider = this.selectedProvider();
        const method = this.selectedMethod();
        if (!provider || !method) return null;
        try {
            const factory = this.registry.get(provider);
            return factory.getFieldRequirements(method);
        } catch {
            return null;
        }
    });

    // === Mostrar resultado ===
    readonly showResult = computed(() => {
        return this.isReady() || this.hasError();
    });

    // === Debug info ===
    readonly debugInfo = this.paymentState.debugSummary;

    constructor() {
        // Auto-seleccionar primer provider disponible
        effect(() => {
            const providers = this.availableProviders();
            if (providers.length > 0 && !this.selectedProvider()) {
                this.selectedProvider.set(providers[0]);
            }
        });

        // Auto-seleccionar primer método cuando cambia el provider
        effect(() => {
            const methods = this.availableMethods();
            const currentMethod = this.selectedMethod();
            if (methods.length > 0 && (!currentMethod || !methods.includes(currentMethod))) {
                this.selectedMethod.set(methods[0]);
            }
        });

        // Log eventos de fallback
        effect(() => {
            const event = this.pendingFallbackEvent();
            if (event) {
                this.logger.info(
                    'Fallback available',
                    'CheckoutPage',
                    {
                        failedProvider: event.failedProvider,
                        alternatives: event.alternativeProviders
                    }
                );
            }
        });
    }

    // === Acciones de selección ===
    selectProvider(provider: PaymentProviderId): void {
        this.selectedProvider.set(provider);
        this.paymentState.selectProvider(provider);
        this.paymentState.clearError();
        this.logger.info('Provider selected', 'CheckoutPage', { provider });
    }

    selectMethod(method: PaymentMethodType): void {
        this.selectedMethod.set(method);
        this.paymentState.clearError();
        this.logger.info('Method selected', 'CheckoutPage', { method });
    }

    // === Handlers del formulario ===
    onFormChange(options: PaymentOptions): void {
        this.formOptions.set(options);
    }

    onFormValidChange(valid: boolean): void {
        this.isFormValid.set(valid);
    }

    // === Proceso de pago ===
    processPayment(): void {
        const provider = this.selectedProvider();
        const method = this.selectedMethod();
        
        if (!provider || !method) return;

        const correlationCtx = this.logger.startCorrelation('payment-flow', {
            orderId: this.orderId(),
            provider,
            method
        });

        try {
            const factory = this.registry.get(provider);
            const builder = factory.createRequestBuilder(method);

            // Obtener opciones del formulario
            let options = this.formOptions();
            
            // En desarrollo, auto-generar token si es requerido y no existe
            if (isDevMode() && method === 'card' && !options.token) {
                options = { ...options, token: 'tok_visa_dev' };
                this.logger.debug('Auto-generated dev token', 'CheckoutPage');
            }

            // Construir request
            const request = builder
                .forOrder(this.orderId())
                .withAmount(this.amount(), this.currency())
                .withOptions(options)
                .build();

            this.logger.info('Payment request built', 'CheckoutPage', {
                orderId: request.orderId,
                amount: request.amount,
                method: request.method.type
            });

            // Ejecutar pago
            this.paymentState.startPayment(request, provider);

        } catch (error) {
            this.logger.error('Failed to build payment request', 'CheckoutPage', error);
        }

        this.logger.endCorrelation(correlationCtx);
    }

    // === Fallback handlers ===
    confirmFallback(provider: PaymentProviderId): void {
        this.logger.info('Fallback confirmed', 'CheckoutPage', { provider });
        this.paymentState.executeFallback(provider);
    }

    cancelFallback(): void {
        this.logger.info('Fallback cancelled', 'CheckoutPage');
        this.paymentState.cancelFallback();
    }

    // === Reset ===
    resetPayment(): void {
        this.paymentState.reset();
        this.orderId.set('order_' + Math.random().toString(36).substring(7));
        this.isFormValid.set(false);
        this.logger.info('Payment reset', 'CheckoutPage');
    }
}
