# Payment Service

Módulo de pagos multi-proveedor para Angular con arquitectura limpia (Clean Architecture).

## Objetivo

Construir un sistema de pagos **extensible y desacoplado** que soporte múltiples proveedores (Stripe, PayPal, futuro Square, Conekta, etc.) sin que la UI conozca los detalles de implementación de cada uno.

**Principios clave:**
- La UI solo conoce **abstracciones** (interfaces), nunca implementaciones concretas
- Cada provider define sus propios **requisitos de campos** y **builders**
- Agregar un nuevo provider **no modifica código existente** (Open/Closed)
- Validación específica de cada provider vive en **Infrastructure**, no en Domain

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                              UI                                     │
│                                                                     │
│  Solo conoce interfaces:                                            │
│  - ProviderFactory                                                  │
│  - PaymentRequestBuilder                                            │
│  - FieldRequirements                                                │
│                                                                     │
│  NO conoce: StripeCardRequestBuilder, PaypalRedirectRequestBuilder  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                         Application                                 │
│                                                                     │
│  UseCases: StartPayment, ConfirmPayment, CancelPayment, GetStatus   │
│  Registry: resuelve ProviderFactory por providerId                  │
│  State: PaymentStatePort (signals)                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                        Infrastructure                               │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │      Stripe      │    │      PayPal      │    │   (Square)   │  │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────┤  │
│  │ Factory          │    │ Factory          │    │ Factory      │  │
│  │ Gateway          │    │ Gateway          │    │ Gateway      │  │
│  │ Builders:        │    │ Builders:        │    │ Builders:    │  │
│  │  - Card          │    │  - Redirect      │    │  - ...       │  │
│  │  - SPEI          │    │                  │    │              │  │
│  └──────────────────┘    └──────────────────┘    └──────────────┘  │
│                                                                     │
│  Shared: CardStrategy, SpeiStrategy                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                           Domain                                    │
│                                                                     │
│  Ports (interfaces):                                                │
│  - PaymentGateway                                                   │
│  - PaymentStrategy                                                  │
│  - ProviderFactory                                                  │
│  - PaymentRequestBuilder                                            │
│                                                                     │
│  Models:                                                            │
│  - PaymentIntent, PaymentError, NextAction                          │
│  - CreatePaymentRequest (genérico)                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Flujo de un Pago

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. UI consulta requisitos del provider/method                      │
│                                                                     │
│     const requirements = factory.getFieldRequirements('card');      │
│     // → { fields: [{ name: 'token', required: true }, ...] }       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  2. UI renderiza formulario dinámico con esos campos                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  3. UI obtiene builder específico (sin saber la clase concreta)     │
│                                                                     │
│     const builder = factory.createRequestBuilder('card');           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  4. UI construye request con el builder                             │
│                                                                     │
│     const request = builder                                         │
│         .forOrder('order_123')                                      │
│         .withAmount(500, 'MXN')                                     │
│         .withOptions({ token: 'tok_visa' })                         │
│         .build();  // Valida campos requeridos                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  5. UseCase ejecuta el pago                                         │
│                                                                     │
│     UseCase → Registry → Factory → Strategy → Gateway → API         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  6. Respuesta normalizada como PaymentIntent                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Estructura del Proyecto

```
src/app/features/payments/
├── application/
│   ├── registry/              # ProviderFactoryRegistry
│   ├── use-cases/             # Start, Confirm, Cancel, GetStatus
│   ├── state/                 # PaymentStatePort (interface)
│   └── tokens/                # DI tokens
│
├── config/
│   └── payment.providers.ts   # Configuración de DI
│
├── domain/
│   ├── models/                # PaymentIntent, PaymentError, Requests
│   ├── ports/                 # Interfaces: Gateway, Strategy, Factory, Builder
│   └── builders/              # Builder genérico (deprecated)
│
├── infrastructure/
│   ├── stripe/
│   │   ├── factories/         # StripeProviderFactory
│   │   ├── gateways/          # StripePaymentGateway
│   │   └── builders/          # StripeCardRequestBuilder, StripeSpeiRequestBuilder
│   ├── paypal/
│   │   ├── factories/         # PaypalProviderFactory
│   │   ├── gateways/          # PaypalPaymentGateway
│   │   ├── strategies/        # PaypalRedirectStrategy
│   │   └── builders/          # PaypalRedirectRequestBuilder
│   ├── fake/                  # FakePaymentGateway para desarrollo
│   └── shared/strategies/     # CardStrategy, SpeiStrategy (reutilizables)
│
├── ui/
│   ├── pages/
│   │   ├── payments/          # Componente de debug/testing
│   │   └── checkout/          # Componente de checkout con builders
│   └── state/                 # Implementación de PaymentStatePort
│
└── docs/
    └── EJEMPLO-USO-BUILDERS.md
```

## Ejecución

```bash
# Instalar dependencias
bun install

# Servidor de desarrollo
bun start
# La app estará en http://localhost:4200

# Tests
bun run test

# Build
bun run build
```

## Rutas Disponibles

| Ruta | Descripción |
|------|-------------|
| `/` | Componente de debug (payments runtime check) |
| `/checkout` | Componente de checkout con sistema de builders |

## Ejemplo de Uso

### En un Componente

```typescript
import { ProviderFactoryRegistry } from '@payments/application/registry';
import { PAYMENTS_STATE } from '@payments/application/tokens';
import { PaymentOptions } from '@payments/domain/ports';

@Component({ ... })
export class CheckoutComponent {
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly paymentState = inject(PAYMENTS_STATE);

    processPayment(provider: 'stripe' | 'paypal', method: 'card' | 'spei') {
        // 1. Obtener factory
        const factory = this.registry.get(provider);

        // 2. Consultar qué campos necesita (para renderizar form)
        const requirements = factory.getFieldRequirements(method);
        console.log(requirements.fields);

        // 3. Obtener builder específico
        const builder = factory.createRequestBuilder(method);

        // 4. Construir request
        const request = builder
            .forOrder('order_123')
            .withAmount(500, 'MXN')
            .withOptions({ token: 'tok_visa_4242' })
            .build();

        // 5. Ejecutar pago
        this.paymentState.start(request, provider);
    }
}
```

### Diferencias Entre Providers

```typescript
// Stripe Card necesita: token
const stripeReqs = stripeFactory.getFieldRequirements('card');
// → { fields: [{ name: 'token', required: true }] }

// Stripe SPEI necesita: customerEmail
const speiReqs = stripeFactory.getFieldRequirements('spei');
// → { fields: [{ name: 'customerEmail', required: true, type: 'email' }] }

// PayPal necesita: returnUrl (redirect flow)
const paypalReqs = paypalFactory.getFieldRequirements('card');
// → { fields: [{ name: 'returnUrl', required: true, autoFill: 'currentUrl' }] }
```

## Agregar un Nuevo Provider

Para agregar un nuevo provider (ej: Conekta):

1. **Crear el Gateway** (`infrastructure/conekta/gateways/`)
   - Implementa `PaymentGateway`
   - Transforma requests al formato de Conekta API

2. **Crear los Builders** (`infrastructure/conekta/builders/`)
   - Un builder por cada método soportado
   - Define `FIELD_REQUIREMENTS` estático
   - Implementa `PaymentRequestBuilder`

3. **Crear la Factory** (`infrastructure/conekta/factories/`)
   - Implementa `ProviderFactory`
   - Métodos: `createRequestBuilder()`, `getFieldRequirements()`

4. **Registrar en DI** (`config/payment.providers.ts`)
   ```typescript
   { provide: PAYMENT_PROVIDER_FACTORIES, useClass: ConektaProviderFactory, multi: true }
   ```

**La UI no cambia.** Solo ve un nuevo provider disponible.

## Patrones de Diseño Utilizados

| Patrón | Uso |
|--------|-----|
| **Builder** | Construcción de requests específicos por provider |
| **Abstract Factory** | `ProviderFactory` crea familias de objetos |
| **Template Method** | `PaymentGateway` define flujo con hooks abstractos |
| **Strategy** | Diferentes comportamientos por método de pago |
| **Registry** | Resolución de factories por providerId |
| **Port/Adapter** | Separación entre contratos e implementaciones |

## Tecnologías

- Angular 19+ (standalone components, signals)
- TypeScript 5.x
- Vitest (testing)
- Bun (package manager)

## Documentación Adicional

- [Progreso del módulo](./docs/payments-progress.md)
- [Ejemplo de uso de builders](./src/app/features/payments/docs/EJEMPLO-USO-BUILDERS.md)
