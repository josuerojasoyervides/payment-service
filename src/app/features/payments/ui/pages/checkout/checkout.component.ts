import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';

// Solo importamos de domain/application, NUNCA de infrastructure
import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import { PaymentProviderId, PaymentMethodType } from '../../../domain/models/payment.types';
import { FieldRequirements, FieldConfig, PaymentOptions } from '../../../domain/ports/payment-request-builder.port';
import { PAYMENTS_STATE } from '../../../application/tokens/payment-state.token';
import { CreatePaymentRequest } from '../../../domain/models/payment.requests';

@Component({
    selector: 'app-checkout',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './checkout.component.html',
    styles: [`
        :host {
            display: block;
            max-width: 800px;
            margin: 0 auto;
            padding: 24px;
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        h1 { margin-bottom: 8px; }
        
        .subtitle {
            color: #666;
            margin-bottom: 24px;
        }
        
        section {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        h3 {
            margin-top: 0;
            margin-bottom: 16px;
            font-size: 1.1rem;
        }
        
        .provider-buttons, .method-buttons {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }
        
        .provider-btn, .method-btn {
            padding: 12px 24px;
            border: 2px solid #ddd;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 1rem;
        }
        
        .provider-btn:hover, .method-btn:hover {
            border-color: #007bff;
        }
        
        .provider-btn.active, .method-btn.active {
            border-color: #007bff;
            background: #007bff;
            color: white;
        }
        
        .provider-btn:disabled, .method-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .form-description {
            color: #666;
            margin-bottom: 16px;
        }
        
        .form-instructions {
            background: #e7f3ff;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 16px;
            color: #0056b3;
        }
        
        .field {
            margin-bottom: 16px;
        }
        
        .field label {
            display: block;
            margin-bottom: 6px;
            font-weight: 500;
        }
        
        .field label .required {
            color: #dc3545;
        }
        
        .field input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 1rem;
            box-sizing: border-box;
        }
        
        .field input:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 3px rgba(0,123,255,0.1);
        }
        
        .order-summary {
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
        }
        
        .order-summary h4 {
            margin: 0 0 12px 0;
        }
        
        .order-line {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        
        .order-line:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 1.2rem;
        }
        
        .pay-button {
            width: 100%;
            padding: 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        .pay-button:hover:not(:disabled) {
            background: #218838;
        }
        
        .pay-button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        
        .result {
            margin-top: 20px;
            padding: 16px;
            border-radius: 8px;
        }
        
        .result.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
        }
        
        .result.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
        }
        
        .result.loading {
            background: #fff3cd;
            border: 1px solid #ffeeba;
        }
        
        pre {
            background: #f4f4f4;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            font-size: 0.85rem;
        }
        
        .debug-section {
            margin-top: 32px;
            padding-top: 20px;
            border-top: 2px dashed #ddd;
        }
        
        .debug-section h3 {
            color: #666;
        }
    `]
})
export class CheckoutComponent {
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly paymentState = inject(PAYMENTS_STATE);

    // === Datos de la orden (simulados) ===
    readonly orderId = signal('order_' + Math.random().toString(36).substring(7));
    readonly amount = signal(499.99);
    readonly currency = signal<'MXN' | 'USD'>('MXN');

    // === Selección del usuario ===
    readonly selectedProvider = signal<PaymentProviderId>('stripe');
    readonly selectedMethod = signal<PaymentMethodType>('card');

    // === Formulario dinámico ===
    readonly paymentForm = new UntypedFormGroup({});

    // === Estado ===
    readonly lastBuiltRequest = signal<CreatePaymentRequest | null>(null);
    readonly buildError = signal<string | null>(null);

    // === Providers disponibles ===
    readonly availableProviders = signal<PaymentProviderId[]>(['stripe', 'paypal']);

    // === Computed: Métodos disponibles para el provider seleccionado ===
    readonly availableMethods = computed(() => {
        try {
            const factory = this.registry.get(this.selectedProvider());
            return factory.getSupportedMethods();
        } catch {
            return [];
        }
    });

    // === Computed: Requisitos de campos ===
    readonly fieldRequirements = computed<FieldRequirements | null>(() => {
        try {
            const factory = this.registry.get(this.selectedProvider());
            return factory.getFieldRequirements(this.selectedMethod());
        } catch {
            return null;
        }
    });

    // === Computed: Estado del pago ===
    readonly paymentSnapshot = computed(() => this.paymentState.getSnapshot());
    readonly isLoading = computed(() => this.paymentSnapshot().status === 'loading');
    readonly paymentResult = computed(() => {
        const snapshot = this.paymentSnapshot();
        if (snapshot.status === 'ready') return { type: 'success' as const, data: snapshot.intent };
        if (snapshot.status === 'error') return { type: 'error' as const, data: snapshot.error };
        if (snapshot.status === 'loading') return { type: 'loading' as const, data: null };
        return null;
    });

    constructor() {
        // Efecto: Reconstruir formulario cuando cambian los requisitos
        effect(() => {
            const requirements = this.fieldRequirements();
            this.rebuildForm(requirements);
        });

        // Suscribirse a cambios del estado de pago
        this.paymentState.subscribe(() => {
            // Trigger re-computation
        });
    }

    // === Acciones ===

    selectProvider(provider: PaymentProviderId): void {
        this.selectedProvider.set(provider);
        this.paymentState.reset();
        this.lastBuiltRequest.set(null);
        this.buildError.set(null);

        // Auto-seleccionar primer método disponible
        const methods = this.availableMethods();
        if (methods.length > 0 && !methods.includes(this.selectedMethod())) {
            this.selectedMethod.set(methods[0]);
        }
    }

    selectMethod(method: PaymentMethodType): void {
        this.selectedMethod.set(method);
        this.paymentState.reset();
        this.lastBuiltRequest.set(null);
        this.buildError.set(null);
    }

    processPayment(): void {
        this.buildError.set(null);
        this.lastBuiltRequest.set(null);

        try {
            // 1. Obtener factory del provider seleccionado
            const factory = this.registry.get(this.selectedProvider());

            // 2. Obtener builder específico (UI no sabe la clase concreta)
            const builder = factory.createRequestBuilder(this.selectedMethod());

            // 3. Obtener valores del formulario
            const options: PaymentOptions = {};
            const formValue = this.paymentForm.value;

            // Mapear valores del form a PaymentOptions
            if (formValue['token']) options.token = formValue['token'];
            if (formValue['returnUrl']) options.returnUrl = formValue['returnUrl'];
            if (formValue['cancelUrl']) options.cancelUrl = formValue['cancelUrl'];
            if (formValue['customerEmail']) options.customerEmail = formValue['customerEmail'];
            if (formValue['saveForFuture']) options.saveForFuture = formValue['saveForFuture'] === 'true';

            // 4. Construir request usando el builder
            const request = builder
                .forOrder(this.orderId())
                .withAmount(this.amount(), this.currency())
                .withOptions(options)
                .build();

            // Guardar para debug
            this.lastBuiltRequest.set(request);

            // 5. Ejecutar pago
            this.paymentState.start(request, this.selectedProvider());

        } catch (error) {
            this.buildError.set((error as Error).message);
        }
    }

    // === Helpers ===

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
}
