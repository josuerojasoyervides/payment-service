# Payments Module — Architecture & Quality Rules

> **Última actualización:** 2026-01-23  
> Este repositorio es un laboratorio para practicar arquitectura realista aplicada a pagos y evolucionar hacia un módulo funcional **sin convertirlo en una telaraña**.

Este documento define reglas de **diseño, boundaries, i18n, errores, providers y tests** para que el proyecto:

- sea mantenible (sin acoplamientos raros),
- sea extensible (agregar providers / métodos sin “romper todo”),
- sea testeable (sin depender de UI ni HTTP real),
- sea consistente (errores e i18n con contrato único).

> Filosofía: **Clean-ish pragmática**. Primero estabilidad y consistencia. Después features y XState.

---

## 1) Principios NO negociables

### 1.1 Propósito

- Arquitectura limpia por capas (sin “cosas en cualquier lado”).
- Flujos claros: **la UI no orquesta**, la Application sí.
- Errors e i18n consistentes: **UI traduce, infra jamás**.

### 1.2 Prohibiciones absolutas

**Domain** debe ser **TypeScript puro**. Prohibido dentro de `domain/`:

- Angular (`@angular/*`) ❌
- RxJS (`Observable`, operadores) ❌
- HTTP (`HttpClient`, `fetch`) ❌
- i18n keys (`I18nKeys`) ❌
- tipos/errores de providers (Stripe/PayPal DTOs) ❌
- Date/time libs y side-effects ❌
- Logger, caching, resiliencia ❌

---

## 2) Capas oficiales y reglas de dependencias

Capas del módulo:

```
src/app/features/payments/
  domain/
  application/
  infrastructure/
  shared/
  ui/
```

### 2.1 Dependencias permitidas (regla de oro)

- `domain/` → **nada**
- `application/` → `domain/` (+ Angular DI/RxJS permitido)
- `infrastructure/` → `application/` + `domain/`
- `shared/` → depende del caso (ver sección 2.2)
- `ui/` → `application/` + `domain/` (por tokens/ports/state), **nunca infrastructure**

> Regla simple: **UI y Domain no saben que existe infraestructura**.

### 2.2 ¿Qué es `shared/` en este repo?

`shared/` es un “cajón controlado” (mezcla intencional) para cosas reutilizables dentro del módulo, por ejemplo:

- strategies de método de pago (`shared/strategies/card-strategy.ts`, `shared/strategies/spei-strategy.ts`)
- helpers puros o adaptadores internos que no pertenecen claramente a 1 capa

**Reglas de `shared/`:**

- ✅ puede depender de `domain/` (tipos)
- ✅ puede depender de `application/` si son helpers de aplicación (con criterio)
- ❌ NO puede depender de `infrastructure/`
- ❌ NO puede depender de `ui/`

---

## 3) Vocabulario (Ports & Adapters)

Este repo usa el estilo **Ports & Adapters**.

- **Port:** interfaz/contrato entre capas (ej. `PaymentGateway`, `PaymentStatePort`)
- **Adapter:** implementación concreta (ej. Stripe/PayPal gateway)
- **Use Case:** orquestación del proceso desde Application (no UI)
- **Orchestrator:** coordinación multi-step (ej. fallback)
- **Registry + Factory:** registro de providers y creación de gateways sin acoplar UI/app a implementaciones

> Nota: este repo usa “Gateway” como “conexión al mundo externo”.

---

## 4) Qué vive en cada capa

### 4.1 Domain (`domain/`)

Debe contener **solo**:

- modelos: `PaymentIntent`, requests, types
- contratos puros (ports TS puro si aplica)
- reglas y tipos de dominio (`PaymentError`, enums, etc.)

Ejemplo:

- `domain/models/payment/payment-error.types.ts`
- `domain/models/payment/payment-intent.types.ts`
- `domain/models/payment/payment-request.types.ts`

### 4.2 Application (`application/`)

Contiene el “cerebro” del módulo:

- use cases (start/confirm/cancel/get)
- ports (interfaces de integración)
- store (NgRx Signals)
- orchestrators (fallback)
- registry + factories

✅ En Application se permite:

- Angular DI (`inject`, `Injectable`)
- RxJS (`Observable`, operadores)
- Signals (NgRx Signals o Angular signals)
- interfaces, contratos y “wiring” de aplicación

**UI NO implementa lógica de negocio**: UI solo dispara acciones y consume estado.

### 4.3 Infrastructure (`infrastructure/`)

Implementaciones concretas hacia el mundo externo:

- Stripe / PayPal
- DTOs
- mappers (DTO → domain)
- normalización de errores provider → `PaymentError`

**Infra puede:**

- usar `HttpClient`
- construir DTOs
- mapear respuestas externas

**Infra NO puede:**

- traducir (`i18n.t(...)`) ❌
- tocar store/UI ❌
- decidir fallback ❌

### 4.4 UI (`ui/`)

- componentes
- render de estados
- disparo de acciones (start/confirm/etc)
- traducción de errores (único lugar permitido)

UI depende de `PAYMENT_STATE`/ports, **no** de implementaciones.

---

## 5) I18n & PaymentError (contrato oficial)

### 5.1 Regla: **UI-only translation**

- ✅ Único lugar donde se permite `i18n.t(...)`: `ui/**` (componentes UI)
- ❌ Prohibido en `domain/`, `application/`, `infrastructure/`, `shared/`

> `I18nKeys` **sí se puede usar en infra/app** para retornar keys, pero nunca para traducir.

### 5.2 Contrato oficial: `PaymentError`

Los errores **viajan como datos**, no como texto traducido.

```ts
export type PaymentErrorParams = Record<string, string | number | boolean | null | undefined>;

export interface PaymentError {
  code: PaymentErrorCode;

  /**
   * i18n key used to render the message in UI.
   * This is the long-term source of truth.
   */
  messageKey: string;

  /**
   * Optional interpolation params for `messageKey`.
   */
  params?: PaymentErrorParams;

  raw: unknown;
}
```

**Reglas duras:**

- `messageKey` **SIEMPRE** debe ser una **key i18n válida** ✅
- `raw` se conserva para debugging y trazabilidad ✅
- `params` se usa para interpolación en UI ✅
- Nunca existe “escape hatch” para mostrar mensajes crudos del provider ❌

### 5.3 Normalización de errores (dónde y cómo)

- Los providers (infra/adapters) deben convertir errores externos a `PaymentError`.
- Application/Store solo consume `PaymentError`.

**Anti-regla importante:**

- ❌ Jamás usar `providerError.message` como `messageKey`.  
  Si necesitas conservarlo, va en `raw` o en `params` (pero UI no lo muestra).

### 5.4 Enforcements recomendados (obligatorio)

Este proyecto requiere enforcement automático:

- Test o lint que falle si encuentra `i18n.t(` fuera de `ui/`
- Test que falle si `PaymentError.messageKey` no empieza con prefijo esperado (ej: `errors.`)

---

## 6) Fallback policy (manual / auto)

### 6.1 Dónde se decide fallback

**Fallback se decide únicamente en Application (store/orchestrator)**.

- ✅ UI muestra modal y responde
- ✅ Store decide cuándo disparar `reportFailure()`
- ❌ Providers no deciden fallback

### 6.2 Qué operaciones usan fallback (estado actual)

Hoy el fallback está implementado para:

- ✅ `createIntent` / `startPayment` (único lugar con `allowFallback: true`)

Confirm/cancel/get **no** disparan fallback por defecto (a menos que se agregue explícitamente).

### 6.3 Modo manual vs auto

`FallbackOrchestratorService` soporta ambos:

- **manual** (default): emite `FallbackAvailableEvent` y UI decide
- **auto**: ejecuta fallback después de un delay sin intervención

Default actual (config):

- `enabled: true`
- `mode: "manual"`
- `maxAttempts: 2`
- `maxAutoFallbacks: 1`
- `triggerErrorCodes: ['provider_unavailable','provider_error','network_error','timeout']`
- `providerPriority: ['stripe','paypal']`

### 6.4 “fallback handled” significa

Si `reportFailure()` devuelve `true`:

- el store hace transición silenciosa (sin dejar la UI en loading infinito)
- el flujo continúa (manual → espera decisión / auto → ejecuta intento)

---

## 7) Providers: estándar esperado

Providers disponibles:

- Stripe
- PayPal
- Mock/Fake

### 7.1 Estándar deseado: Gateway + Operations (por operación)

El patrón objetivo es **una operación = un gateway refactor** (como Stripe):

- `CreateIntentGateway` (execute)
- `ConfirmIntentGateway`
- `CancelIntentGateway`
- `GetIntentGateway`

PayPal actualmente puede estar legacy (monolítico), pero debe migrar a este estándar.

### 7.2 Qué debe hacer un provider gateway (mínimo)

- ✅ normalizar errores a `PaymentError`
- ✅ retornar modelos de dominio (no DTOs)
- ✅ mapear status externo → status interno

Opcional:

- telemetry/logging (idealmente vía base/wrapper)

### 7.3 Prohibiciones

Un provider gateway NO puede:

- tocar store ❌
- tocar UI ❌
- traducir ❌
- decidir fallback ❌

---

## 8) Testing mínimo (scope realista)

No buscamos 100% coverage. Buscamos **tests que eviten regresiones**.

### 8.1 Regla mínima por Gateway

Cada gateway debe tener tests para:

- happy path (ok)
- invalid request
- provider error
- normalize error
- edge cases relevantes

### 8.2 Regla mínima del Orchestrator/Store

- fallback no genera loops
- eventos expirados no rompen el flow
- UI no se queda “colgada”

---

## 9) Anti-patterns (lo que NO se permite)

- UI importando `infrastructure/**`
- `i18n.t(...)` fuera de UI
- Domain importando Angular/RxJS
- Gateways retornando DTOs crudos hacia arriba
- `messageKey` usando texto real en vez de key i18n

---

## 10) Evolución: cómo agregar cosas sin romper todo

Cuando agregues un provider o método:

1. Define el contrato en Domain (models / request shape)
2. Expón el port correcto en Application
3. Implementa adapter en Infrastructure (con normalización de errores)
4. Conecta por Factory/Registry
5. UI solo consume el estado y traduce
