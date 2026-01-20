# Payment Service

Módulo de pagos multi-proveedor para Angular con arquitectura hexagonal (Ports & Adapters) y Clean Architecture.

## Objetivo

Construir un sistema de pagos **extensible, resiliente y desacoplado** que soporte múltiples proveedores (Stripe, PayPal, futuro MercadoPago, Conekta, etc.) sin que la UI conozca los detalles de implementación de cada uno.

**Principios clave:**
- La UI solo conoce **abstracciones** (interfaces/ports), nunca implementaciones concretas
- Cada provider define sus propios **requisitos de campos** y **builders**
- Agregar un nuevo provider **no modifica código existente** (Open/Closed)
- Validación específica de cada provider vive en **Infrastructure**, no en Domain
- **Resiliencia integrada**: Circuit Breaker, Rate Limiting, Retry con backoff, Fallback entre proveedores

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   UI                                        │
│  Solo conoce interfaces: ProviderFactory, PaymentRequestBuilder, Store      │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                              Application                                    │
│                                                                             │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │  Use Cases  │  │     Registry     │  │     FallbackOrchestrator       │  │
│  │  - Start    │  │  Resuelve        │  │  - Modo manual/automático      │  │
│  │  - Confirm  │  │  factories por   │  │  - Prioridad de providers      │  │
│  │  - Cancel   │  │  providerId      │  │  - Timeout configurable        │  │
│  │  - GetStatus│  │                  │  │                                │  │
│  └─────────────┘  └──────────────────┘  └────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    PaymentsStore (NgRx Signals)                     │    │
│  │  Estado reactivo: intent, status, error, fallback, history          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                             Infrastructure                                  │
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐   │
│  │      Stripe      │    │      PayPal      │    │    (MercadoPago)     │   │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────────────┤   │
│  │ Factory          │    │ Factory          │    │ Factory              │   │
│  │ Gateway          │    │ Gateway          │    │ Gateway              │   │
│  │ Builders:        │    │ Builders:        │    │ Builders:            │   │
│  │  - Card          │    │  - Redirect      │    │  - Card, OXXO...     │   │
│  │  - SPEI          │    │                  │    │                      │   │
│  │ Validators:      │    │ Validators:      │    │                      │   │
│  │  - Token         │    │  - Token         │    │                      │   │
│  └──────────────────┘    └──────────────────┘    └──────────────────────┘   │
│                                                                             │
│  Shared: CardStrategy, SpeiStrategy (reutilizables entre providers)         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                               Domain                                        │
│                                                                             │
│  Ports (contratos):                    Models:                              │
│  - PaymentGateway                      - PaymentIntent, PaymentError        │
│  - PaymentStrategy                     - CreatePaymentRequest               │
│  - ProviderFactory                     - FallbackConfig, FallbackState      │
│  - PaymentRequestBuilder               - NextAction (3DS, redirect, SPEI)   │
│  - TokenValidator                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                                Core                                         │
│                                                                             │
│  Servicios transversales de resiliencia y observabilidad:                   │
│  - CircuitBreakerService    - RateLimiterService    - RetryService          │
│  - CacheService             - LoggerService                                 │
│                                                                             │
│  Interceptors:                                                              │
│  - ResilienceInterceptor (Circuit Breaker + Rate Limiting)                  │
│  - RetryInterceptor (Exponential backoff)                                   │
│  - CacheInterceptor                                                         │
│  - LoggingInterceptor                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Características Principales

### Multi-Provider con Fallback Inteligente
- Soporta múltiples proveedores de pago simultáneamente
- Fallback automático o manual cuando un provider falla
- Prioridad configurable de proveedores
- Detección de errores elegibles para fallback

### Resiliencia Integrada
- **Circuit Breaker**: Previene llamadas a servicios que están fallando
- **Rate Limiting**: Controla exceso de requests del cliente
- **Retry con Backoff**: Reintentos inteligentes con espera exponencial
- **Logging estructurado**: Trazabilidad con correlationId

### Estado Reactivo
- NgRx Signals para estado inmutable
- Computed properties optimizadas
- Historial de transacciones
- Integración con RxJS para efectos

## Estructura del Proyecto

```
src/app/
├── core/                           # Servicios transversales
│   ├── interceptors/               # HTTP interceptors
│   │   ├── resilience.interceptor.ts
│   │   ├── retry.interceptor.ts
│   │   ├── cache.interceptor.ts
│   │   └── logging.interceptor.ts
│   ├── services/                   # Servicios de infraestructura
│   │   ├── circuit-breaker.service.ts
│   │   ├── rate-limiter.service.ts
│   │   ├── cache.service.ts
│   │   ├── retry.service.ts
│   │   └── logger.service.ts
│   ├── models/                     # Tipos de configuración
│   └── operators/                  # Operadores RxJS custom
│
└── features/payments/
    ├── domain/
    │   ├── models/                 # PaymentIntent, Errors, Requests, Fallback
    │   └── ports/                  # Interfaces: Gateway, Strategy, Factory, Builder
    │
    ├── application/
    │   ├── use-cases/              # Start, Confirm, Cancel, GetStatus
    │   ├── registry/               # ProviderFactoryRegistry
    │   ├── services/               # FallbackOrchestratorService
    │   ├── store/                  # PaymentsStore (NgRx Signals)
    │   ├── adapters/               # NgRxSignalsStateAdapter
    │   └── tokens/                 # DI tokens
    │
    ├── infrastructure/
    │   ├── stripe/
    │   │   ├── factories/          # StripeProviderFactory
    │   │   ├── gateways/           # StripePaymentGateway
    │   │   ├── builders/           # StripeCardRequestBuilder, StripeSpeiRequestBuilder
    │   │   ├── validators/         # StripeTokenValidator
    │   │   └── dto/                # Tipos específicos de Stripe API
    │   ├── paypal/
    │   │   ├── factories/          # PaypalProviderFactory
    │   │   ├── gateways/           # PaypalPaymentGateway
    │   │   ├── builders/           # PaypalRedirectRequestBuilder
    │   │   ├── strategies/         # PaypalRedirectStrategy
    │   │   └── validators/         # PaypalTokenValidator
    │   └── fake/                   # FakePaymentGateway para desarrollo
    │
    ├── shared/strategies/          # CardStrategy, SpeiStrategy (reutilizables)
    │
    ├── config/                     # payment.providers.ts
    │
    └── ui/pages/                   # Componentes de presentación
        ├── checkout/
        └── payments/
```

## Path Aliases

El proyecto usa path aliases para imports más limpios:

```typescript
// Antes
import { PaymentIntent } from '../../../domain/models/payment/payment-intent.types';

// Después
import { PaymentIntent } from '@payments/domain';
import { PaymentGateway } from '@payments/ports';
import { CircuitBreakerService } from '@core/services/circuit-breaker.service';
```

Aliases disponibles:
- `@core/*` → `src/app/core/*`
- `@payments/*` → `src/app/features/payments/*`
- `@payments/domain` → Models del dominio
- `@payments/ports` → Interfaces/contratos
- `@payments/application/*` → Use cases, registry, store
- `@payments/infrastructure/*` → Implementaciones de providers

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

## Patrones de Diseño Utilizados

| Patrón | Implementación | Propósito |
|--------|---------------|-----------|
| **Abstract Factory** | `ProviderFactory` | Crea familias de objetos relacionados (gateway + strategies + builders) |
| **Strategy** | `PaymentStrategy` | Encapsula algoritmos de validación/preparación por método de pago |
| **Builder** | `PaymentRequestBuilder` | Construye requests complejos con validación |
| **Template Method** | `PaymentGateway` | Define el esqueleto del algoritmo, subclases implementan detalles |
| **Registry** | `ProviderFactoryRegistry` | Punto único de acceso a factories con cache |
| **Port/Adapter** | `PaymentGateway` (port) → `StripePaymentGateway` (adapter) | Inversión de dependencias |
| **Circuit Breaker** | `CircuitBreakerService` | Resiliencia ante servicios que fallan repetidamente |
| **Observer** | `FallbackOrchestratorService` | Comunicación reactiva de eventos de fallback |

## Ejemplo de Uso

### Iniciar un Pago

```typescript
import { ProviderFactoryRegistry } from '@payments/application/registry/provider-factory.registry';
import { PaymentsStore } from '@payments/application/store/payment.store';

@Component({ ... })
export class CheckoutComponent {
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly store = inject(PaymentsStore);

    // Signals del store
    readonly isLoading = this.store.isLoading;
    readonly intent = this.store.currentIntent;
    readonly error = this.store.currentError;
    readonly hasFallback = this.store.hasPendingFallback;

    processPayment(provider: 'stripe' | 'paypal', method: 'card' | 'spei') {
        const factory = this.registry.get(provider);
        
        // Obtener requisitos de campos para el formulario
        const requirements = factory.getFieldRequirements(method);
        
        // Construir request con el builder
        const request = factory.createRequestBuilder(method)
            .forOrder('order_123')
            .withAmount(500, 'MXN')
            .withOptions({ token: 'tok_visa_4242' })
            .build();

        // Ejecutar pago
        this.store.startPayment({ request, providerId: provider });
    }
}
```

### Configurar Fallback Automático

```typescript
// En providers del módulo
{ 
    provide: FALLBACK_CONFIG, 
    useValue: { 
        mode: 'auto',
        autoFallbackDelay: 2000,
        maxAutoFallbacks: 1,
        providerPriority: ['stripe', 'paypal']
    } 
}
```

## Agregar un Nuevo Provider

Para agregar un nuevo provider (ej: MercadoPago):

1. **Crear estructura en `infrastructure/mercadopago/`:**
   - `gateways/mercadopago-payment.gateway.ts` - Extiende `PaymentGateway`
   - `factories/mercadopago-provider.factory.ts` - Implementa `ProviderFactory`
   - `builders/mercadopago-*-request.builder.ts` - Implementa `PaymentRequestBuilder`
   - `validators/mercadopago-token.validator.ts` - Implementa `TokenValidator`

2. **Registrar en DI** (`config/payment.providers.ts`):
   ```typescript
   { provide: PAYMENT_PROVIDER_FACTORIES, useClass: MercadoPagoProviderFactory, multi: true }
   ```

**La UI no cambia.** Solo verá un nuevo provider disponible en el registry.

## Tecnologías

- Angular 19+ (standalone components, signals)
- NgRx Signals (estado reactivo)
- TypeScript 5.x
- RxJS 7+
- Vitest (testing)
- Bun (package manager)

## Documentación

- [Progreso del módulo](./docs/payments-progress.md)
- [Ejemplo de uso de builders](./docs/EJEMPLO-USO-BUILDERS.md)
