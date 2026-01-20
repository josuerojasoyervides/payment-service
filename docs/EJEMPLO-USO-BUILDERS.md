# Ejemplo Completo: Uso de Builders en el Sistema de Pagos

Este documento muestra cómo la UI interactúa con el sistema de builders
sin acoplarse a las implementaciones específicas de cada provider.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│  UI (Componente de Checkout)                                    │
│                                                                 │
│  Solo conoce:                                                   │
│  - ProviderFactory (interface)                                  │
│  - PaymentRequestBuilder (interface)                            │
│  - FieldRequirements (interface)                                │
│  - PaymentProviderId ('stripe' | 'paypal')                      │
│                                                                 │
│  NO conoce:                                                     │
│  - StripeCardRequestBuilder                                     │
│  - PaypalRedirectRequestBuilder                                 │
│  - Ninguna clase de infrastructure                              │
└─────────────────────────────────────────────────────────────────┘
```

## Ejemplo de Componente de Checkout

```typescript
// ui/pages/checkout/checkout.component.ts

import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// SOLO importamos de domain/application, NUNCA de infrastructure
import { ProviderFactoryRegistry } from '@payments/application/registry';
import { PaymentProviderId, PaymentMethodType } from '@payments/domain/models';
import { FieldRequirements, PaymentOptions } from '@payments/domain/ports';
import { PAYMENTS_STATE } from '@payments/application/tokens';

@Component({
    selector: 'app-checkout',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    template: `
        <!-- PASO 1: Seleccionar Provider -->
        <section>
            <h3>Método de pago</h3>
            @for (provider of availableProviders(); track provider) {
                <button 
                    (click)="selectProvider(provider)"
                    [class.active]="selectedProvider() === provider">
                    {{ provider }}
                </button>
            }
        </section>

        <!-- PASO 2: Seleccionar Método (si el provider tiene varios) -->
        @if (availableMethods().length > 1) {
            <section>
                <h4>Tipo de pago</h4>
                @for (method of availableMethods(); track method) {
                    <button 
                        (click)="selectMethod(method)"
                        [class.active]="selectedMethod() === method">
                        {{ method }}
                    </button>
                }
            </section>
        }

        <!-- PASO 3: Formulario dinámico según el provider/method -->
        @if (fieldRequirements()) {
            <section>
                <h4>{{ fieldRequirements()!.description }}</h4>
                <p>{{ fieldRequirements()!.instructions }}</p>
                
                <form [formGroup]="paymentForm">
                    @for (field of fieldRequirements()!.fields; track field.name) {
                        @if (field.type !== 'hidden') {
                            <div class="field">
                                <label>
                                    {{ field.label }}
                                    @if (field.required) { <span>*</span> }
                                </label>
                                <input 
                                    [type]="field.type"
                                    [formControlName]="field.name"
                                    [placeholder]="field.placeholder ?? ''" />
                            </div>
                        }
                    }
                </form>
            </section>
        }

        <!-- PASO 4: Botón de pago -->
        <button 
            (click)="processPayment()"
            [disabled]="isLoading()">
            {{ isLoading() ? 'Procesando...' : 'Pagar $' + amount() }}
        </button>
    `
})
export class CheckoutComponent {
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly paymentState = inject(PAYMENTS_STATE);
    private readonly fb = inject(FormBuilder);

    // Datos de la orden (vendrían del carrito)
    readonly orderId = signal('order_123');
    readonly amount = signal(500);
    readonly currency = signal<'MXN' | 'USD'>('MXN');

    // Selección del usuario
    readonly selectedProvider = signal<PaymentProviderId>('stripe');
    readonly selectedMethod = signal<PaymentMethodType>('card');

    // Formulario dinámico
    readonly paymentForm = this.fb.group<Record<string, any>>({});

    // Estado de carga
    readonly isLoading = computed(() => 
        this.paymentState.getSnapshot().status === 'loading'
    );

    // Providers disponibles (podrían venir de config)
    readonly availableProviders = signal<PaymentProviderId[]>(['stripe', 'paypal']);

    // Métodos disponibles para el provider seleccionado
    readonly availableMethods = computed(() => {
        const factory = this.registry.get(this.selectedProvider());
        return factory.getSupportedMethods();
    });

    // Requisitos de campos para el provider/method seleccionado
    readonly fieldRequirements = computed<FieldRequirements | null>(() => {
        try {
            const factory = this.registry.get(this.selectedProvider());
            return factory.getFieldRequirements(this.selectedMethod());
        } catch {
            return null;
        }
    });

    constructor() {
        // Actualizar formulario cuando cambian los requisitos
        // (En un caso real usarías effect() de Angular)
    }

    selectProvider(provider: PaymentProviderId): void {
        this.selectedProvider.set(provider);
        
        // Auto-seleccionar el primer método disponible
        const methods = this.availableMethods();
        if (methods.length > 0) {
            this.selectedMethod.set(methods[0]);
        }
        
        this.rebuildForm();
    }

    selectMethod(method: PaymentMethodType): void {
        this.selectedMethod.set(method);
        this.rebuildForm();
    }

    /**
     * Reconstruye el formulario según los requisitos del provider/method.
     */
    private rebuildForm(): void {
        const requirements = this.fieldRequirements();
        if (!requirements) return;

        // Limpiar formulario
        Object.keys(this.paymentForm.controls).forEach(key => {
            this.paymentForm.removeControl(key);
        });

        // Agregar campos según requisitos
        for (const field of requirements.fields) {
            let defaultValue = field.defaultValue ?? '';
            
            // Auto-fill para campos especiales
            if (field.autoFill === 'currentUrl') {
                defaultValue = window.location.href;
            }

            this.paymentForm.addControl(
                field.name, 
                this.fb.control(defaultValue)
            );
        }
    }

    /**
     * Procesa el pago usando el builder específico del provider.
     */
    processPayment(): void {
        // 1. Obtener la factory del provider seleccionado
        const factory = this.registry.get(this.selectedProvider());

        // 2. Obtener el builder específico para este provider/method
        //    La UI NO sabe qué clase concreta es (StripeCardRequestBuilder, etc.)
        //    Solo sabe que implementa PaymentRequestBuilder
        const builder = factory.createRequestBuilder(this.selectedMethod());

        // 3. Construir el request usando el builder
        //    El builder sabe qué campos necesita de las options
        const options: PaymentOptions = this.paymentForm.value;

        const request = builder
            .forOrder(this.orderId())
            .withAmount(this.amount(), this.currency())
            .withOptions(options)
            .build();  // Valida que los campos requeridos estén

        // 4. Ejecutar el pago
        this.paymentState.start(request, this.selectedProvider());
    }
}
```

## Flujo Visual

```
Usuario selecciona "PayPal"
         │
         ▼
┌─────────────────────────────────────────┐
│ registry.get('paypal')                  │
│   → PaypalProviderFactory               │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ factory.getFieldRequirements('card')    │
│   → { fields: [returnUrl, cancelUrl] }  │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ UI renderiza formulario con esos campos │
│ (returnUrl es hidden, auto-filled)      │
└─────────────────────────────────────────┘
         │
         ▼
Usuario hace clic en "Pagar"
         │
         ▼
┌─────────────────────────────────────────┐
│ factory.createRequestBuilder('card')    │
│   → PaypalRedirectRequestBuilder        │
│   (pero UI no sabe el nombre concreto)  │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ builder                                 │
│   .forOrder('order_123')                │
│   .withAmount(500, 'MXN')               │
│   .withOptions({ returnUrl: '...' })    │
│   .build()                              │
│                                         │
│ → Valida que returnUrl exista           │
│ → Retorna CreatePaymentRequest          │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ paymentState.start(request, 'paypal')   │
│   → UseCase → Strategy → Gateway        │
└─────────────────────────────────────────┘
```

## Comparación: Stripe vs PayPal

### Con Stripe Card

```typescript
// Usuario selecciona Stripe + Card
const factory = registry.get('stripe');
const requirements = factory.getFieldRequirements('card');
// requirements = {
//   description: 'Pago con tarjeta de crédito o débito',
//   fields: [
//     { name: 'token', required: true, type: 'hidden' },
//     { name: 'saveForFuture', required: false }
//   ]
// }

const builder = factory.createRequestBuilder('card');
const request = builder
    .forOrder('order_123')
    .withAmount(500, 'MXN')
    .withOptions({ token: 'tok_visa_4242' })  // Token de Stripe Elements
    .build();

// request = {
//   orderId: 'order_123',
//   amount: 500,
//   currency: 'MXN',
//   method: { type: 'card', token: 'tok_visa_4242' }
// }
```

### Con PayPal

```typescript
// Usuario selecciona PayPal
const factory = registry.get('paypal');
const requirements = factory.getFieldRequirements('card');
// requirements = {
//   description: 'Pagar con PayPal',
//   fields: [
//     { name: 'returnUrl', required: true, type: 'hidden', autoFill: 'currentUrl' },
//     { name: 'cancelUrl', required: false }
//   ]
// }

const builder = factory.createRequestBuilder('card');
const request = builder
    .forOrder('order_123')
    .withAmount(500, 'MXN')
    .withOptions({ returnUrl: 'https://mitienda.com/checkout' })
    .build();

// request = {
//   orderId: 'order_123',
//   amount: 500,
//   currency: 'MXN',
//   method: { type: 'card' },
//   returnUrl: 'https://mitienda.com/checkout',
//   cancelUrl: 'https://mitienda.com/checkout'  // Default a returnUrl
// }
```

### Con Stripe SPEI

```typescript
// Usuario selecciona Stripe + SPEI
const factory = registry.get('stripe');
const requirements = factory.getFieldRequirements('spei');
// requirements = {
//   description: 'Transferencia bancaria SPEI',
//   fields: [
//     { name: 'customerEmail', required: true, type: 'email' }
//   ]
// }

const builder = factory.createRequestBuilder('spei');
const request = builder
    .forOrder('order_123')
    .withAmount(500, 'MXN')
    .withOptions({ customerEmail: 'usuario@email.com' })
    .build();

// request = {
//   orderId: 'order_123',
//   amount: 500,
//   currency: 'MXN',
//   method: { type: 'spei' },
//   customerEmail: 'usuario@email.com'
// }
```

## Beneficios de Esta Arquitectura

| Beneficio | Descripción |
|-----------|-------------|
| **Sin acoplamiento** | UI solo importa de domain/application |
| **Type-safe** | TypeScript valida en compile-time |
| **Extensible** | Agregar provider = crear factory + builders |
| **UI dinámica** | Formulario se adapta al provider |
| **Validación específica** | Cada builder valida sus requisitos |
| **Separación de concerns** | UI no sabe de HTTP ni APIs externas |

## Agregar un Nuevo Provider (Ej: Conekta)

1. Crear `ConektaPaymentGateway` en infrastructure/conekta
2. Crear `ConektaOxxoRequestBuilder` con sus requisitos
3. Crear `ConektaProviderFactory` que implemente `ProviderFactory`
4. Registrar en `payment.providers.ts`

**La UI no cambia.** Solo ve un nuevo provider disponible.
