# Payment Service

Servicio de pagos multi-proveedor para Angular, diseñado con arquitectura limpia y extensible.

## Objetivo

Demostrar cómo construir un módulo de pagos realista que soporte múltiples proveedores (Stripe, PayPal, futuro Square) sin acoplamiento a APIs externas reales. El enfoque es aprender diseño escalable, testeable y mantenible.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                           UI                                │
│  (PaymentsComponent consume PaymentStatePort vía signals)   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                      Application                            │
│  UseCases: Start, Confirm, Cancel, GetStatus                │
│  Registry: resuelve ProviderFactory por providerId          │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Infrastructure                           │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Stripe    │    │   PayPal    │    │   (Square)  │     │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤     │
│  │ Factory     │    │ Factory     │    │ Factory     │     │
│  │ Gateway     │    │ Gateway     │    │ Gateway     │     │
│  │ (centavos)  │    │ (Orders v2) │    │ (futuro)    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  Shared Strategies: CardStrategy, SpeiStrategy              │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                        Domain                               │
│  Ports: PaymentGateway, PaymentStrategy, ProviderFactory    │
│  Models: PaymentIntent, PaymentError, NextAction            │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de un Pago

```
Usuario → StartPaymentUseCase → Registry.get(provider)
                                    ↓
                              Factory.createStrategy(method)
                                    ↓
                              Strategy.validate() → prepare() → start()
                                    ↓
                              Gateway.createIntent() → API transform → response map
                                    ↓
                              PaymentIntent (modelo unificado)
```

## Estructura del Proyecto

```
src/app/features/payments/
├── application/
│   ├── registry/          # ProviderFactoryRegistry
│   ├── use-cases/         # Start, Confirm, Cancel, GetStatus
│   ├── state/             # PaymentStatePort
│   └── tokens/            # DI tokens
├── config/
│   └── payment.providers.ts  # Configuración de DI
├── domain/
│   ├── models/            # PaymentIntent, PaymentError, NextAction
│   └── ports/             # Interfaces: Gateway, Strategy, Factory
├── infrastructure/
│   ├── stripe/            # Factory, Gateway, DTOs
│   ├── paypal/            # Factory, Gateway, Strategy (redirect)
│   ├── fake/              # FakePaymentGateway para desarrollo
│   └── shared/strategies/ # CardStrategy, SpeiStrategy
└── ui/
    ├── pages/             # PaymentsComponent
    └── state/             # Implementación de PaymentStatePort
```

## Ejecución

```bash
# Instalar dependencias
bun install

# Servidor de desarrollo
bun start
# o
ng serve

# Tests (105 tests)
bun run test
# o
ng test

# Build
bun run build
```

## Características Implementadas

### Gateways con Transformación Real

- **Stripe**: Convierte montos a centavos, formatea requests según Stripe API
- **PayPal**: Usa Orders API v2, montos como strings, maneja links HATEOAS

### Estrategias con Validación

- **CardStrategy**: Valida tokens (`tok_*`, `pm_*`), montos mínimos, detecta 3DS
- **SpeiStrategy**: Valida MXN, montos min/max, calcula expiración 72h
- **PaypalRedirectStrategy**: Prepara flujo de redirección

### Manejo de Errores

- Humanización de errores de cada proveedor a mensajes en español
- Mapeo de códigos de error a tipos internos (`card_declined`, `provider_error`)

### Testing

- 105 tests unitarios con Vitest + Angular TestBed
- Tests para gateways, strategies, factories, use cases y registry

## Tecnologías

- Angular 19+ (standalone components, signals)
- TypeScript 5.x
- Vitest (testing)
- Bun (package manager)

## Documentación Adicional

- [Progreso del módulo](/docs/payments-progress.md)
