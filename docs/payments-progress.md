# Progreso del módulo Payments (demo)

## Objetivo del demo

Construir un módulo de pagos realista y extensible (Stripe/PayPal/futuro Square) sin integrar procesadores reales. El enfoque es aprender diseño escalable, testeable y mantenible en Angular con una arquitectura clean-ish: `domain / application / infrastructure / ui`.

Principios clave:
- Domain con contratos y validaciones base; uso mínimo de Angular.
- Application con use cases pequeños y claros.
- Infrastructure pluginable por proveedor.
- UI consume una API simple (port), sin conocer factories ni strategies.
- Tests unitarios rápidos con Vitest + TestBed.

---

## Estado actual

### Arquitectura y wiring
- Multi DI de providers configurado.
- Registry con validaciones de duplicados y providers faltantes.
- Factories por proveedor y selección de strategy por método.
- Gateways con validación, transformación y normalización de errores.
- Interceptor fake para simular backend.
- UI consume un `PaymentStatePort` vía token (`PAYMENTS_STATE`).

### Domain (modelos actuales)

Separación aplicada en `domain/models/`:
- `payment.types.ts`: tipos core (`PaymentIntent`, `PaymentStatus`, etc.).
- `payment.actions.ts`: `NextAction` (redirect, spei, 3ds, paypal_approve).
- `payment.requests.ts`: `Create/Confirm/Cancel/GetStatus`.
- `payment.methods.ts`: `PaymentMethod`.
- `payment.errors.ts`: `PaymentError`.

### Use cases

| Use Case | Estado | Tests |
|----------|--------|-------|
| `StartPaymentUseCase` | ✅ Completo | ✅ 11 tests |
| `ConfirmPaymentUseCase` | ✅ Completo | ✅ 3 tests |
| `CancelPaymentUseCase` | ✅ Completo | ✅ 3 tests |
| `GetPaymentStatusUseCase` | ✅ Completo | ✅ 3 tests |

### Gateways

| Gateway | Transformación | Errores | Tests |
|---------|---------------|---------|-------|
| `StripePaymentGateway` | ✅ Centavos, formato Stripe | ✅ Humanizados ES | ✅ 4 tests |
| `PaypalPaymentGateway` | ✅ Orders API v2, strings | ✅ Humanizados ES | ✅ 4 tests |
| `PaymentGateway` (base) | ✅ Validación base | ✅ Normalización | ✅ 23 tests |

### Estrategias

| Strategy | Validación | Preparación | Tests |
|----------|-----------|-------------|-------|
| `CardStrategy` | ✅ Token, monto mínimo | ✅ Metadata 3DS | ✅ 16 tests |
| `SpeiStrategy` | ✅ MXN, min/max | ✅ Expiración 72h | ✅ 16 tests |
| `PaypalRedirectStrategy` | ✅ Solo card | ✅ URLs retorno | ✅ 1 test |

### Factories

| Factory | Strategies soportadas | Tests |
|---------|----------------------|-------|
| `StripeProviderFactory` | card, spei | ✅ 4 tests |
| `PaypalProviderFactory` | card (redirect) | ✅ 3 tests |

### Cobertura de Tests

```
Test Files  16 passed
     Tests  105 passed
```

---

## Checklist de lo completado

### Fase 1: Arquitectura base
- [x] Estructura clean-ish con capas definidas
- [x] Multi DI y Registry
- [x] Ports definidos (Gateway, Strategy, Factory)
- [x] Modelos de dominio separados y tipados

### Fase 2: Implementación de Gateways
- [x] Gateway base con template method pattern
- [x] StripePaymentGateway con transformación a centavos
- [x] PaypalPaymentGateway con Orders API v2
- [x] Humanización de errores en español
- [x] Tests de gateways

### Fase 3: Implementación de Strategies
- [x] CardStrategy con validación de tokens y 3DS
- [x] SpeiStrategy con validación MXN y expiración
- [x] PaypalRedirectStrategy para flujo OAuth
- [x] Tests de strategies

### Fase 4: Factories y Registry
- [x] StripeProviderFactory (card, spei)
- [x] PaypalProviderFactory (card vía redirect)
- [x] ProviderFactoryRegistry con validaciones
- [x] Tests de factories y registry

### Fase 5: Use Cases
- [x] StartPaymentUseCase
- [x] ConfirmPaymentUseCase
- [x] CancelPaymentUseCase
- [x] GetPaymentStatusUseCase
- [x] Tests de use cases

### Fase 6: UI State
- [x] PaymentStatePort definido
- [x] Implementación con signals
- [x] Tests de state

---

## Decisiones de diseño

### Patrón Strategy + Gateway + Factory

```
UseCase → Registry → Factory → Strategy → Gateway → API
```

Cada capa tiene una responsabilidad:
- **UseCase**: Orquesta el flujo de negocio
- **Registry**: Encuentra la factory por provider
- **Factory**: Crea la strategy por método de pago
- **Strategy**: Valida, prepara y enriquece
- **Gateway**: Transforma al formato de la API externa

### Transformación en Gateway, no en Strategy

El gateway conoce el formato exacto de la API externa:
- Stripe: centavos, `payment_method`, `payment_method_types`
- PayPal: strings con decimales, `purchase_units`, links HATEOAS

La strategy prepara datos genéricos; el gateway los transforma.

### Errores humanizados por proveedor

Cada gateway traduce errores específicos a mensajes legibles:
```typescript
// Stripe
'card_declined' → 'El pago fue rechazado. Por favor verifica los datos de tu tarjeta.'

// PayPal  
'INSTRUMENT_DECLINED' → 'El método de pago fue rechazado por PayPal.'
```

---

## Pendientes

### Corto plazo
- [ ] Extender fake backend para confirm/cancel/get
- [ ] Simular flujos completos:
  - Card: `requires_confirmation → processing → succeeded`
  - PayPal: `requires_action → succeeded`
  - SPEI: `requires_action → processing → succeeded`

### Mediano plazo
- [ ] UI reacciona a `nextAction` sin lógica por provider
- [ ] SquareProviderFactory para validar extensibilidad
- [ ] Documentación de flujos con diagramas

### Largo plazo
- [ ] `HandleRedirectReturnUseCase`
- [ ] `HandleWebhookUseCase`
- [ ] Escenarios de error y reintentos

---

## Próximo paso sugerido

Implementar el flujo completo de UI: el componente de pagos debe usar `PaymentStatePort` para iniciar pagos, mostrar estados intermedios (`requires_action`, `processing`) y reaccionar a `nextAction` para redirecciones o instrucciones SPEI.
