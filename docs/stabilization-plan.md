# Stabilization Plan — v3 (pre‑XState)

> **Última actualización:** 2026-01-23  
> Branch de referencia: `origin/refactor/stabilization-plan-v3`

Objetivo: **estabilizar y cerrar ciclos** en lo que ya existe para que:

- el módulo sea consistente,
- sea fácil de refactorizar,
- y quede listo para migrar flow complejo a XState **sin reescrituras**.

---

## 0) Snapshot real (estado actual del repo)

✅ Ya existen piezas clave que NO se deben romper:

- `ProviderFactoryRegistry` como única entrada a providers
- Factories registradas vía token multi (`PAYMENT_PROVIDER_FACTORIES`)
- Use cases separados por operación (start/confirm/cancel/get)
- Store con rxMethods cortos (sin mega‑pipes)
- UI desacoplada usando `PAYMENT_STATE` token
- `FallbackOrchestratorService` con estado + eventos (manual/auto)
- Contrato base de error: `PaymentError` con `messageKey + params? + raw`

🟡 Inconsistencias que aún existen (y bloquean cierre):

- `messageKey` no está 100% blindado como “solo key i18n” (hay leaks posibles)
- compatibilidad legacy en UI/store para errores viejos
- providers no están estandarizados (Stripe “operations”, PayPal legacy)
- docs desactualizados vs código actual

---

## 1) Checklist de estabilización (con estado)

### 1.1 Boundaries base (capas)

- ✅ Carpeta por capa: `domain / application / infrastructure / shared / ui`
- ✅ Domain TS puro (sin Angular/RxJS/HTTP/i18n keys)
- ✅ UI no importa infraestructura directo

**Riesgo:** `shared/` es mezcla → mantenerlo controlado (no dejar que se convierta en basurero).

---

### 1.2 Registry + factories

- ✅ Registry central (`ProviderFactoryRegistry`)
- ✅ Factories registradas vía token multi
- ✅ `getGateway()` existe y se usa en ejecución de operaciones

---

### 1.3 Store & flow

- ✅ UI “consume state” (no hace orquestación)
- ✅ Flow stateful implementado (intent/confirm/cancel/get)
- 🟡 Store sin estados muertos
  - hoy se ve estable, pero falta “hard proof” vía tests + cleanup final

---

### 1.4 Fallback

- ✅ Orchestrator funciona (manual/auto)
- ✅ Fallback se decide en Store (no en UI/infra)
- ✅ No deja UI colgada (handled → transición silenciosa)
- ✅ Fallback aplicado solo a `startPayment/createIntent` (por diseño actual)

---

### 1.5 I18n & errores (cierre de ciclo)

- ✅ UI-only translation (solo UI usa `i18n.t(...)`)
- 🟡 PaymentError final (messageKey+params)
  - contrato ya existe, pero hay compatibilidad legacy y riesgo de leaks
- ❌ Enforcement automático aún pendiente (lint/test)

---

### 1.6 Providers (consistencia)

- ✅ Stripe sigue patrón “operations” por intent
- ❌ PayPal sigue legacy (requiere refactor)
- 🟡 Mock/Fake existe pero falta garantizar que cumpla el mismo contrato

---

### 1.7 Tests base

- ✅ Tests principales pasan
- 🟡 Falta endurecer tests para evitar regresiones del contrato de error/i18n

---

## 2) Bloqueadores actuales (P0)

### P0.1 `messageKey` debe ser SIEMPRE key i18n

**Regla:** no se permite texto real como `messageKey`.

**Acciones**

- Asegurar que cualquier mapper/error handler retorne **siempre** `I18nKeys.*`
- Eliminar cualquier fallback tipo “si no hay key usa error.message”

---

### P0.2 Matar compatibilidad legacy de errores

Mientras exista soporte legacy, el ciclo i18n/errores nunca se cierra.

**Acciones**

- UI: eliminar render condicional que use `message` legacy
- Store: eliminar normalización que acepte `message` legacy
- Specs: actualizar fixtures a `messageKey + params`

---

### P0.3 Docs alineados con repo

Los docs deben describir el código real.

**Acciones**

- actualizar `architecture-rules.md`
- actualizar `stabilization-plan.md`
- actualizar `goals.md`

---

## 3) Pendientes importantes (P1)

### P1.1 Refactor de PayPal al estándar de Stripe

Objetivo: PayPal debe tener “operations” por operación:

- createIntent
- confirmIntent
- cancelIntent
- getIntent

Y todos deben:

- normalizar `PaymentError`
- retornar domain models
- no tocar fallback ni UI

---

### P1.2 Unificar API legacy vs refactor de gateway

Hoy coexisten:

- `PaymentGateway` (legacy con métodos)
- `PaymentGatewayRefactor<TRequest,TResponse>` (execute genérico)
- `PaymentGatewayPort<TRequest,TDto,TResponse>` (base)

Objetivo de estabilización:

- documentar claramente qué es legacy
- definir plan de migración (sin romper use cases)

---

## 4) Migración a XState (P1/P2)

Scope de migración (acordado):

- flow de intent/confirm
- fallback
- retries/resiliencia

NgRx Signals se queda para:

- historial
- estado actual
- derived state para UI

---

## 5) Mini plan incremental (3 ramas sugeridas)

### Rama 1 — Cerrar contrato de error (P0)

- blindar `messageKey` como i18n key
- eliminar soporte legacy de `message`

### Rama 2 — Providers consistentes (P1)

- refactor PayPal → operations
- alinear contratos con Stripe

### Rama 3 — XState kickoff (P1/P2)

- crear machine base del flow
- integrar con use cases/store sin reescribir UI

---

## 6) Definition of Done de esta estabilización

✅ Se considera “cerrado” cuando:

- `PaymentError` solo usa `messageKey + params? + raw`
- `messageKey` es siempre key i18n
- `i18n.t(...)` solo existe en UI
- PayPal y Stripe comparten patrón de gateway/operations
- tests mínimos por gateway existen y pasan
- docs reflejan el estado real del repo
