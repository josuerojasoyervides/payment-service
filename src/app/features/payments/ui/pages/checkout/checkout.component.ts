import { Component, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Port y token (desacoplado de implementación)
import { PAYMENTS_STATE } from '../../../application/tokens/payment-state.token';
import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import { LoggerService } from '../../../../../core/services/logger.service';

// Domain types
import { PaymentProviderId, PaymentMethodType } from '../../../domain/models/payment.types';
import { FieldRequirements, FieldConfig, PaymentOptions } from '../../../domain/ports/payment-request-builder.port';

/**
 * Componente de checkout para procesar pagos.
 * 
 * Este componente está desacoplado de la implementación del estado
 * gracias al uso del token PAYMENTS_STATE. Esto permite:
 * - Cambiar de NgRx Signals a otra librería sin modificar el componente
 * - Testing más fácil con mocks del port
 * - Menor acoplamiento y mayor mantenibilidad
 */
@Component({
    selector: 'app-checkout',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './checkout.component.html',
    styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent {
    // Servicios - estado inyectado vía token (desacoplado)
    private readonly paymentState = inject(PAYMENTS_STATE);
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly logger = inject(LoggerService);

    // === Datos de la orden (simulados) ===
    readonly orderId = signal('order_' + Math.random().toString(36).substring(7));
    readonly amount = signal(499.99);
    readonly currency = signal<'MXN' | 'USD'>('MXN');

    // === Selección del usuario ===
    readonly selectedProvider = signal<PaymentProviderId>('stripe');
    readonly selectedMethod = signal<PaymentMethodType>('card');

    // === Formulario dinámico ===
    readonly paymentForm = new UntypedFormGroup({});

    // === Estado del store (vía port) ===
    readonly isLoading = this.paymentState.isLoading;
    readonly isReady = this.paymentState.isReady;
    readonly hasError = this.paymentState.hasError;
    readonly currentIntent = this.paymentState.intent;
    readonly currentError = this.paymentState.error;

    // === Estado del fallback ===
    readonly hasPendingFallback = this.paymentState.hasPendingFallback;
    readonly pendingFallbackEvent = this.paymentState.pendingFallbackEvent;
    readonly selectedFallbackProvider = signal<PaymentProviderId | null>(null);

    // === Providers disponibles ===
    readonly availableProviders = computed<PaymentProviderId[]>(() => {
        return this.registry.getAvailableProviders();
    });

    // === Métodos disponibles para el provider seleccionado ===
    readonly availableMethods = computed(() => {
        try {
            const factory = this.registry.get(this.selectedProvider());
            return factory.getSupportedMethods();
        } catch {
            return [];
        }
    });

    // === Requisitos de campos ===
    readonly fieldRequirements = computed<FieldRequirements | null>(() => {
        try {
            const factory = this.registry.get(this.selectedProvider());
            return factory.getFieldRequirements(this.selectedMethod());
        } catch {
            return null;
        }
    });

    // === Debug info ===
    readonly debugInfo = this.paymentState.debugSummary;

    constructor() {
        // Efecto: Reconstruir formulario cuando cambian los requisitos
        effect(() => {
            const requirements = this.fieldRequirements();
            this.rebuildForm(requirements);
        });

        // Efecto: Escuchar eventos de fallback
        effect(() => {
            const event = this.pendingFallbackEvent();
            if (event) {
                this.logger.info(
                    'Fallback available',
                    'CheckoutComponent',
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

        // Auto-seleccionar primer método disponible
        const methods = this.availableMethods();
        if (methods.length > 0 && !methods.includes(this.selectedMethod())) {
            this.selectedMethod.set(methods[0]);
        }

        this.logger.info('Provider selected', 'CheckoutComponent', { provider });
    }

    selectMethod(method: PaymentMethodType): void {
        this.selectedMethod.set(method);
        this.paymentState.clearError();

        this.logger.info('Method selected', 'CheckoutComponent', { method });
    }

    // === Proceso de pago ===

    processPayment(): void {
        // Iniciar correlación para tracing
        const correlationCtx = this.logger.startCorrelation('payment-flow', {
            orderId: this.orderId(),
            provider: this.selectedProvider(),
            method: this.selectedMethod()
        });

        try {
            const factory = this.registry.get(this.selectedProvider());
            const builder = factory.createRequestBuilder(this.selectedMethod());

            // Obtener valores del formulario
            const options = this.getPaymentOptions();

            // Construir request
            const request = builder
                .forOrder(this.orderId())
                .withAmount(this.amount(), this.currency())
                .withOptions(options)
                .build();

            this.logger.info('Payment request built', 'CheckoutComponent', {
                orderId: request.orderId,
                amount: request.amount,
                method: request.method.type
            });

            // Ejecutar pago via state port
            this.paymentState.startPayment(request, this.selectedProvider());

        } catch (error) {
            this.logger.error('Failed to build payment request', 'CheckoutComponent', error);
        }

        this.logger.endCorrelation(correlationCtx);
    }

    // === Fallback handlers ===

    selectFallbackProvider(provider: PaymentProviderId): void {
        this.selectedFallbackProvider.set(provider);
    }

    confirmFallback(): void {
        const provider = this.selectedFallbackProvider();
        if (!provider) return;

        this.logger.info('Fallback confirmed', 'CheckoutComponent', { provider });
        this.paymentState.executeFallback(provider);
        this.selectedFallbackProvider.set(null);
    }

    cancelFallback(): void {
        this.logger.info('Fallback cancelled', 'CheckoutComponent');
        this.paymentState.cancelFallback();
        this.selectedFallbackProvider.set(null);
    }

    // === Reset ===

    resetPayment(): void {
        this.paymentState.reset();
        this.orderId.set('order_' + Math.random().toString(36).substring(7));
        this.logger.info('Payment reset', 'CheckoutComponent');
    }

    // === Helpers ===

    private getPaymentOptions(): PaymentOptions {
        const options: PaymentOptions = {};
        const formValue = this.paymentForm.value;
        const requirements = this.fieldRequirements();

        // Token: usar valor del form o generar uno de prueba en desarrollo
        if (formValue['token']) {
            options.token = formValue['token'];
        } else if (isDevMode() && this.isHiddenField('token', requirements)) {
            // En desarrollo, auto-generar token de prueba para campos hidden
            // En producción, Stripe Elements llenaría este campo
            options.token = 'tok_visa_dev';
            this.logger.debug('Auto-generated dev token for hidden field', 'CheckoutComponent');
        }

        if (formValue['returnUrl']) options.returnUrl = formValue['returnUrl'];
        if (formValue['cancelUrl']) options.cancelUrl = formValue['cancelUrl'];
        if (formValue['customerEmail']) options.customerEmail = formValue['customerEmail'];
        if (formValue['saveForFuture']) options.saveForFuture = formValue['saveForFuture'] === 'true';

        return options;
    }

    private isHiddenField(fieldName: string, requirements: FieldRequirements | null): boolean {
        if (!requirements) return false;
        const field = requirements.fields.find(f => f.name === fieldName);
        return field?.type === 'hidden';
    }

    private rebuildForm(requirements: FieldRequirements | null): void {
        // Limpiar formulario existente
        Object.keys(this.paymentForm.controls).forEach(key => {
            this.paymentForm.removeControl(key);
        });

        if (!requirements) return;

        // Agregar controles según requisitos
        for (const field of requirements.fields) {
            let defaultValue = field.defaultValue ?? '';

            // Auto-fill para campos especiales
            if (field.autoFill === 'currentUrl') {
                defaultValue = window.location.href;
            }

            this.paymentForm.addControl(
                field.name,
                new FormControl(defaultValue, { nonNullable: true })
            );
        }
    }

    isFieldVisible(field: FieldConfig): boolean {
        return field.type !== 'hidden';
    }

    getFieldType(field: FieldConfig): string {
        if (field.type === 'hidden') return 'text';
        return field.type;
    }

    getStatusClass(status: string): string {
        return status.replace(/_/g, '-');
    }
}
