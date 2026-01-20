import { Component, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

// Port y token (desacoplado de implementación)
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import { LoggerService } from '@core/logging';
import { I18nService, I18nKeys } from '@core/i18n';

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
    templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
    readonly isDevMode = isDevMode();

    // Servicios
    private readonly paymentState = inject(PAYMENT_STATE);
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly logger = inject(LoggerService);
    private readonly i18n = inject(I18nService);

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
            // El token debe cumplir el formato de Stripe: tok_ seguido de al menos 14 caracteres alfanuméricos (sin guiones bajos)
            // PayPal no requiere token (usa flujo de redirección)
            if (isDevMode() && method === 'card' && provider === 'stripe' && !options.token) {
                options = { ...options, token: 'tok_visa1234567890abcdef' };
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

    // ===== Textos para el template =====
    get checkoutTitle(): string {
        return this.i18n.t(I18nKeys.ui.checkout);
    }

    get paymentSystemSubtitle(): string {
        return this.i18n.t(I18nKeys.ui.payment_system);
    }

    get viewHistoryLabel(): string {
        return this.i18n.t(I18nKeys.ui.view_history);
    }

    get checkStatusLabel(): string {
        return this.i18n.t(I18nKeys.ui.check_status);
    }

    get showcaseLabel(): string {
        return this.i18n.t(I18nKeys.ui.showcase);
    }

    get paymentProviderLabel(): string {
        return this.i18n.t(I18nKeys.ui.payment_provider);
    }

    get paymentMethodLabel(): string {
        return this.i18n.t(I18nKeys.ui.payment_method);
    }

    get paymentDataLabel(): string {
        return this.i18n.t(I18nKeys.ui.payment_data);
    }
}
