# Progreso del módulo Payments (demo)

## Objetivo del demo
Construir un módulo de pagos realista y extensible (Stripe/PayPal/futuro Square) sin integrar procesadores reales. El enfoque es aprender diseño escalable, testeable y mantenible en Angular con una arquitectura clean-ish: `domain / application / infrastructure / ui`.

Principios clave:
- Domain con contratos y validaciones base; uso mínimo de Angular (por ejemplo `inject(HttpClient)` en gateways).
- Application con use cases pequeños y claros.
- Infrastructure pluginable por proveedor.
- UI consume una API simple (facade), sin conocer factories ni strategies.
- Tests unitarios rápidos con Vitest + TestBed.

## Estado actual
### Arquitectura y wiring
- Multi DI de providers configurado.
- Registry con validaciones de duplicados y providers faltantes.
- Factories por proveedor y selección de strategy por método.
- Gateways con validación y normalización de errores.
- Interceptor fake para simular backend.
- UI con facade basado en signals.

### Domain (modelos actuales)
Separación ya aplicada en `domain/models/`:
- `payment.types.ts`: tipos core (`PaymentIntent`, `PaymentStatus`, etc.).
- `payment.actions.ts`: `NextAction` (redirect, spei, 3ds).
- `payment.requests.ts`: `Create/Confirm/Cancel/GetStatus`.
- `payment.methods.ts`: `PaymentMethod`.
- `payment.errors.ts`: `PaymentError`.

Estado de tipos destacados:
- `PaymentStatus` incluye `processing`.
- `CreatePaymentRequest.currency` tipado como `CurrencyCode`.
- `PaymentIntent` incluye `nextAction`.

### Use cases
- `StartPaymentUseCase` funcionando y testeado.
- `ConfirmPaymentUseCase`, `CancelPaymentUseCase`, `GetPaymentStatusUseCase` conectados a gateway vía `ProviderFactory.getGateway()`.

### Infra actual
- Gateways para Stripe/PayPal con endpoints de create/confirm/cancel/get.
- Fake backend intercepta create/confirm/cancel/get para Stripe y PayPal.
- Strategies compartidas (card/spei) y strategy específica de PayPal (redirect).

## Decisiones de diseño (clean-ish pragmático)
- Se acepta acoplamiento mínimo a Angular en Domain para IO básico.
- No se permite lógica de UI ni composición avanzada de Angular en Domain.
- El flujo se modela con `PaymentIntent.status` y `nextAction` para evitar condicionales por proveedor en UI.

## Checklist de lo ya hecho
- [x] Estructura clean-ish con capas definidas.
- [x] Multi DI y Registry.
- [x] Gateways por proveedor (create/confirm/cancel/get).
- [x] Strategies y factories.
- [x] Facade UI con signals.
- [x] Fake backend interceptor.
- [x] Tests base para registry y gateway abstracto.
- [x] Tests para nuevos use cases (confirm/cancel/get).
- [x] Tests verdes después de la conexión use case → gateway.
- [x] Modelos de dominio separados y tipados.

## Pendientes inmediatos (corto plazo)
1) Añadir tests de gateways Stripe/PayPal para confirm/cancel/get.
2) Definir si se incluye `square` en `PaymentProviderId` ahora o en una fase posterior.

## Plan a corto plazo (1-2 iteraciones)
- Extender Domain + Ports para flujo completo.
- Implementar use cases nuevos con tests unitarios.
- Simular flujos en fake backend:
  - Card: `requires_confirmation -> processing -> succeeded`
  - PayPal redirect: `requires_action -> succeeded`
  - Spei: `requires_action -> processing -> succeeded`

## Plan a mediano plazo
- Actualizar `PaymentsFacade` a una state machine basada en `PaymentIntent.status`.
- UI reacciona a `nextAction` sin lógica por provider.
- Agregar `SquareProviderFactory` para validar extensibilidad sin cambios en Application/UI.

## Plan a largo plazo
- Use cases opcionales:
  - `HandleRedirectReturnUseCase`
  - `HandleWebhookUseCase`
- Extender escenarios de error y reintentos.
- Añadir documentación de flujo y diagramas.

## Riesgos y mitigaciones
- **Acoplamiento UI a providers**: mitigado con `nextAction` y `PaymentIntent.status`.
- **Crecimiento de Domain**: mitigado con separación en archivos por intención.
- **Duplicidad de lógica en strategies**: mantener estrategias compartidas y solo especializar cuando sea necesario.

## Próximo paso sugerido
Actualizar fake backend para confirm/cancel/get y añadir tests de gateways por proveedor.
