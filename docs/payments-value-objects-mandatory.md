---
name: Payments — Value Objects Obligatorios (continuación)
overview: Documento único con diagnóstico del estado actual + prompts listos (PR3–PR6) para que un worker implemente la adopción obligatoria de VOs sin "VO por deporte", manteniendo Domain limpio y con evidencia verificable.
todos: []
isProject: false
---

# Payments — Value Objects Obligatorios (continuación)

## 0) Estado actual (lo que ya quedó hecho)

### ✅ Paso 0 — VO toolkit mínimo (completo)

- violation.types.ts: tipo Violation con code y meta.
- result.types.ts: tipo Result<T, V> como:
  - { ok: true; value: T }
  - { ok: false; violations: V[] }

### ✅ Paso 1 — Money VO (completo y adoptado)

- currency.types.ts: CURRENCY_CODES y CurrencyCode movidos a domain/common.
- money.vo.ts: Money.create(amount, currency): Result<Money, MoneyViolation>
  - Invariantes: Number.isFinite, amount > 0, máx 2 decimales, currency en catálogo.
  - Normalización: Math.round(amount \* 100) / 100.
- Integración:
  - PaymentIntent usa money: Money (ya no amount + currency).
  - CreatePaymentRequest usa money: Money.
  - validateSpeiAmount / validateCardAmount aceptan Money.
  - Builders validan (p.ej. createMoneyOrThrow()).
  - Mappers/gateways/estrategias/UI/specs ajustados.
- Validación:
  - bun run test → 716 tests passing ✅
  - bun run dep:check → OK ✅

---

## 1) Diagnóstico (con la idea "VO obligatorios" en mente)

### ✅ Lo que sí cumple el objetivo "limpiar Domain"

- Domain se mantiene sin:
  - Angular/RxJS/DI tokens.
  - i18n keys / UI schema / HTML autocomplete.
  - throw new Error(...) dentro de Domain.
- Money no es "decorativo": está en los contratos core (CreatePaymentRequest, PaymentIntent), rules y flujo.

### ⚠️ Lo que todavía NO cumple el propósito (pendientes reales)

Esto no es "está mal"; es "todavía no te da la garantía de tipos".

1. VOs Paso 2–5 aún no están adoptados en el core en todos lados:

- orderId sigue siendo string en varios contratos/paths clave.
- intentId sigue siendo string en confirm/cancel/get-status.
- URLs (return/cancel/redirect) siguen como string en varios modelos/contratos.
- timestamps siguen como number y hay al menos un Date (inconsistencia).
- flowId sigue como string (si hoy es string "libre", el VO aún no te protege).

2. Validación en el edge (builders/policies) ayuda, pero no reemplaza la adopción en tipos:

- Si el tipo final es string, el resto del sistema puede mezclar orderId con intentId sin que TypeScript lo frene.

### 🔧 Podría mejorar (para que el refactor sea más sólido y menos doloroso)

- UrlString: decidir si se permiten credenciales tipo user:pass@host y/o fragments #...
- TimestampMs: estandarizar todo a epoch ms (y eliminar Date en el outlier).
- Evitar "doble mundo" permanente: si hay funciones que aceptan string | VO como puente, cerrarlo al completar el paso.

### ✨ Nice to have

- Guardrails automáticos:
  - test que falle si aparece throw new Error( en domain/.
  - reglas depcruise específicas para evitar futuros leaks.
- Helpers tipados de testing (fuera de Domain) para crear VOs rápido sin ruido en specs.

---

## 2) Prompts listos para el worker (PR3–PR6)

Nota: Estos prompts incluyen explícitamente un apartado de revisión:

- ¿Qué debería separarse en otro archivo?
- ¿Está en la ubicación/capa adecuada?

---

# PR3 — Paso 2: Adoptar PaymentIntentId + OrderId (end-to-end)

Prompt para el worker (copy/paste)

# PR3 — Payments Domain: Adopt PaymentIntentId + OrderId (mandatory VOs)

Objetivo (1 frase)
Hacer que el feature payments deje de usar string para intentId y orderId en sus contratos core, adoptando PaymentIntentId y OrderId end-to-end (Domain → Application → Infrastructure → UI/tests), sin romper tests ni boundaries.

Contexto mínimo

- Ya existen VOs y specs:
  - src/app/features/payments/domain/common/primitives/ids/payment-intent-id.vo.ts
  - src/app/features/payments/domain/common/primitives/ids/order-id.vo.ts
- Money VO ya está adoptado en:
  - CreatePaymentRequest.money: Money
  - PaymentIntent.money: Money
- Objetivo: VOs obligatorios por necesidad (evitar mezclar ids), no por estética.

Reglas estrictas

- Domain: sin Angular/RxJS/DI; sin throw.
- No any (excepto tests si es absolutamente inevitable, pero preferir helpers tipados).
- No branching por provider en UI/app (respeta las reglas del repo).
- Respetar naming/ubicación:
  - VOs: \*.vo.ts en domain/common/primitives/\*\*
  - Messages: domain/subdomains/\*_/messages/_.command.ts y \*.event.ts
  - Entities (data): domain/subdomains/\*_/entities/_.types.ts y \*.model.ts

Plan (máx 5 bullets)

1. Cambiar contratos Domain:
   - CreatePaymentRequest.orderId: OrderId
   - ConfirmPaymentRequest.intentId: PaymentIntentId
   - CancelPaymentRequest.intentId: PaymentIntentId
   - GetPaymentStatusRequest.intentId: PaymentIntentId
   - PaymentIntent.id: PaymentIntentId
2. Actualizar puntos de creación/parseo (edge):
   - Builders / adapters / mappers que reciben strings externos deben convertir a VO con from(...)
3. Actualizar consumers:
   - Gateways/DTO mappers/infra deben usar .value al hablar con providers
4. Actualizar tests y harnesses:
   - Crear helpers tipados fuera de Domain para construir VOs rápido (p.ej. application/api/testing/vo-test-helpers.ts)
5. Validar y dejar evidencia

Checks obligatorios (pega outputs)

- bun run test
- bun run dep:check
- bun run lint:fix
- grep -RInE "@angular|rxjs|inject(" src/app/features/payments/domain || true
- grep -RIn "throw new Error" src/app/features/payments/domain || true
- grep -RIn "intentId: string" src/app/features/payments/domain || true
- grep -RIn "orderId: string" src/app/features/payments/domain || true

Entregables

1. Lista de archivos modificados
2. Resumen corto de decisiones (2–5 bullets)
3. Outputs de comandos
4. ¿Qué debería separarse en otro archivo?
   - Señala si surgieron helpers/consts que convenga mover a _.helper.ts, _.rule.ts o \*.factory.ts
5. ¿Está en la ubicación/capa adecuada?
   - Marca cualquier cosa que haya quedado en Domain pero debería vivir en Application/Shared/Infra (o al revés)
6. Nota de compat:
   - Si tuviste que usar puente temporal (p.ej. aceptar string | VO), documenta dónde y agrega un TODO explícito para cerrarlo al final del PR

Intención técnica (por qué este PR es "obligatorio")

- intentId vs orderId vs paymentId se mezclan fácil cuando todo es string
- PaymentIntentId y OrderId reducen bugs por intercambio accidental y hacen que el compilador proteja

---

# PR4 — Paso 3: Adoptar UrlString VO (returnUrl/cancelUrl/redirect)

Prompt para el worker (copy/paste)

# PR4 — Payments Domain: Adopt UrlString VO

Objetivo (1 frase)
Reemplazar URLs críticas (returnUrl, cancelUrl, y URLs de redirect cuando aplique) de string a UrlString, con validación en el edge y sin introducir leaks de UI/infra en Domain.

Contexto mínimo

- Ya existe:
  - src/app/features/payments/domain/common/primitives/url-string.vo.ts
- Hay validaciones de URL en builders; este PR busca que el tipo sea source of truth

Reglas estrictas

- Domain sin throw
- No meter i18n keys al Domain
- Si hay decisiones de seguridad (credenciales embebidas / fragments), documentarlas

Plan (máx 5 bullets)

1. Revisar UrlString:
   - ¿permite user:pass@host? decidir si se prohíbe
   - ¿permite fragments #...? decidir
   - Ajustar specs en consecuencia
2. Cambiar contratos Domain a UrlString:
   - CreatePaymentRequest.returnUrl?: UrlString
   - CreatePaymentRequest.cancelUrl?: UrlString
   - ConfirmPaymentRequest.returnUrl?: UrlString (si aplica)
   - PaymentFlowContext.returnUrl?: UrlString y cancelUrl?: UrlString (si aplican)
3. Actualizar builders/adapters:
   - Parsear desde string externo → UrlString.from(...)
4. Actualizar consumers:
   - Providers/DTOs usan .value
5. Validar y dejar evidencia

Checks obligatorios (pega outputs)

- bun run test
- bun run dep:check
- bun run lint:fix

Entregables

- Lista de archivos modificados
- Resumen de decisiones (incluye seguridad de UrlString)
- Outputs de comandos
- ¿Qué debería separarse en otro archivo?
- ¿Está en la ubicación/capa adecuada?

---

# PR5 — Paso 4: TimestampMs VO + unificar Date vs number

Prompt para el worker (copy/paste)

# PR5 — Payments Domain: Adopt TimestampMs VO (unify time)

Objetivo (1 frase)
Estandarizar instantes temporales en el feature payments usando TimestampMs (epoch ms), eliminando inconsistencias Date vs number, propagándolo en Domain → Application → Infra → tests sin romper el sistema.

Contexto mínimo

- Ya existe:
  - src/app/features/payments/domain/common/primitives/time/timestamp-ms.vo.ts
- Hay propiedades con timestamps en flow context, webhook events, fallback state, etc.
- Hay al menos un Date que rompe consistencia

Reglas estrictas

- Domain sin throw
- No convertir todo a Date; la intención es epoch ms tipado
- Serialización/persistencia debe almacenar number (usando .value)

Plan (máx 5 bullets)

1. Cambiar Domain a usar TimestampMs en propiedades clave:
   - flow context: createdAt/expiresAt/lastReturnAt (si aplican)
   - events: occurredAt, timestamp, etc.
   - fallback: timestamps de intentos/eventos
2. Unificar el outlier: donde haya Date, migrarlo a TimestampMs o eliminarlo si no es necesario
3. Actualizar mappers/serialización/persistencia: .value para guardar/loggear como number
4. Actualizar tests/harnesses: helpers tipados para crear timestamps
5. Validación y evidencia

Checks obligatorios (pega outputs)

- bun run test
- bun run dep:check
- bun run lint:fix

Entregables

- Lista de archivos modificados
- Resumen de decisiones
- Outputs de comandos
- ¿Qué debería separarse en otro archivo?
- ¿Está en la ubicación/capa adecuada?

---

# PR6 — Paso 5: FlowId VO (opcional, recomendado como cierre)

Prompt para el worker (copy/paste)

# PR6 — Payments Domain: Adopt FlowId VO (optional)

Objetivo (1 frase)
Evitar flowId como string arbitrario adoptando FlowId como VO en PaymentFlowContext y en IdempotencyKeyFactory.generateForFlowOperation, manteniendo compatibilidad controlada y tests en verde.

Contexto mínimo

- Ya existe:
  - src/app/features/payments/domain/common/primitives/ids/flow-id.vo.ts
- flowId se usa para correlación y generación de llaves de idempotencia

Plan (máx 5 bullets)

1. Cambiar PaymentFlowContext.flowId?: FlowId
2. Ajustar generador de flow id (si existe) para retornar FlowId
3. Actualizar idempotency factory para usar flowId.value
4. Actualizar tests/harnesses
5. Validar y dejar evidencia

Checks obligatorios (pega outputs)

- bun run test
- bun run dep:check
- bun run lint:fix

Entregables

- Lista de archivos modificados
- Resumen de decisiones
- Outputs de comandos
- ¿Qué debería separarse en otro archivo?
- ¿Está en la ubicación/capa adecuada?

---

## 3) Orden recomendado (mínimo churn, máximo valor)

1. PR3 (IDs) — máximo valor: evita bugs por mezclar strings
2. PR4 (URLs) — valor alto, pero decidir seguridad primero
3. PR5 (timestamps) — churn moderado, pero elimina inconsistencia
4. PR6 (flowId) — cierre para correlación

---

## 4) Checklist final de "VO obligatorios" (cuando termines PR3–PR6)

- No existe intentId: string en contratos Domain
- No existe orderId: string en contratos Domain
- URLs críticas son UrlString, no string
- timestamps críticos son TimestampMs, no number/Date mezclados
- flowId (si se adopta) es FlowId
- Edges que reciben input externo convierten con from(...)
- Providers/DTOs usan .value (interop explícita)
- bun run test, bun run dep:check, bun run lint:fix en verde
- Domain sigue libre de Angular/RxJS/throws/i18n/UI schema
