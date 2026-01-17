# Payment Service (demo)

Demo avanzado en Angular 21 (standalone) para diseñar un módulo de pagos con arquitectura clean-ish: `domain / application / infrastructure / ui`. No integra procesadores reales; simula flujos de Stripe/PayPal con un fake backend.

## Objetivo
Aprender a construir un sistema de pagos escalable, extensible y testeable:
- múltiples proveedores (Stripe, PayPal, futuro Square)
- múltiples métodos (card, spei)
- flujos por combinación proveedor/método
- UI desacoplada de detalles de infraestructura

## Estado actual (resumen)
- Domain con modelos y contratos claros.
- Application con `StartPaymentUseCase` y use cases nuevos (`Confirm/Cancel/GetStatus`).
- Registry con multi DI.
- Gateways por proveedor con `create/confirm/cancel/get`.
- Fake backend intercepta endpoints de create/confirm/cancel/get.
- UI con panel de runtime y acciones sobre intent.

## Estructura relevante
```
src/app/features/payments/
  domain/
    models/
    ports/
  application/
    registry/
    use-cases/
  infrastructure/
    stripe/
    paypal/
    fake/
  shared/
    strategies/
  ui/
    facades/
    pages/
```

## Cómo ejecutar
Instalar dependencias:
```bash
bun install
```

Levantar el proyecto:
```bash
bun run start
```

Abrir:
```
http://localhost:4200/
```

## Tests
```bash
bun run test
```

Cobertura:
```bash
bun run test:coverage
```

## Fake backend
Se usa un `HttpInterceptor` para simular:
- `POST /api/payments/{provider}/intents`
- `POST /api/payments/{provider}/intents/confirm`
- `POST /api/payments/{provider}/intents/cancel`
- `GET /api/payments/{provider}/intents/:id`

Archivo:
- `src/app/core/interceptors/fake-backend.interceptor.ts`

## UI runtime
Pantalla principal:
- `src/app/features/payments/ui/pages/payments/`

Incluye:
- panel de providers y métodos
- self-test de wiring
- ejecución del pipeline completo
- acciones sobre intent (confirm/cancel/get)

## Notas de diseño
- Clean-ish pragmático: el domain usa Angular mínimo para IO.
- Strategy solo para selección por método en `start`.
- Use cases de `confirm/cancel/get` usan gateway directo por provider.
