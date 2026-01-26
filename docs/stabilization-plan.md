# Stabilization Plan — v3 (XState)

> **Última revisión:** 2026-01-26  
> Branch de referencia (histórica): `origin/refactor/stabilization-plan-v3`

## Objetivo

**Estabilizar y cerrar ciclos** en lo que ya existe para que:

- el módulo sea consistente,
- sea fácil de refactorizar,
- quede listo para migrar flow complejo a XState **sin reescrituras**.

Este plan es deliberadamente agresivo: primero consistencia y testabilidad, después features.

---

## 0) Snapshot real (as‑of 2026-01-24)

✅ Piezas clave que NO se deben romper:

- ✅ Arquitectura por capas (`domain/application/infrastructure/shared/ui/config`)
- ✅ PaymentError existe como contrato (`messageKey + params + raw`)
- ✅ FallbackOrchestratorService existe (manual/auto)
- ✅ Fallback se decide en XState (no en UI/infra/store)
- ✅ Fallback se dispara cuando hay request de arranque disponible
- ✅ Stripe y PayPal ya siguen patrón **facade + operations** (ya no hay “PayPal legacy”)

⚠️ Deuda visible hoy:

- UI aún soporta rendering legacy de errores (`message` crudo)
- Hay casos donde `messageKey` se usa como texto traducido o texto literal (UI/tests)
- Falta enforcement automático (lint/test) para evitar regresiones

---

## 1) Workstreams (con prioridades)

### 1.1 I18n & errores (cierre de ciclo) — **P0**

**Meta:** UI-only translation + PaymentError puro.

**DoD de este workstream:**

- UI traduce una vez: `i18n.t(error.messageKey, error.params)`
- No existe `PaymentError.message` en ningún path de render
- `messageKey` nunca contiene texto traducido

**Tareas**

- [P0] Eliminar compatibilidad legacy de `message` en render de errores
- [P0] Prohibir `messageKey = i18n.t(...)` (solo keys)
- [P0] Actualizar specs que usan texto como `messageKey`
- [P1] Agregar enforcement automático (ver 1.4)

📌 Estado actual:

- ✅ UI-only translation se cumple en el feature (fuera de UI no hay `i18n.t`)
- ✅ PaymentError ya no acepta rendering legacy de `message`
- ✅ Enforcement automático agregado (guardrails en tests)

---

### 1.2 Providers parity (Stripe/PayPal) — **P0 ya cerrado**

**Meta:** mismo patrón, misma API, mismos invariantes.

**DoD:**

- Facade por provider
- Operaciones atómicas (create/confirm/cancel/getStatus)
- Mappers DTO → Domain
- Normalización de errores a PaymentError (keys)

📌 Estado actual:

- ✅ DONE (Stripe y PayPal ya están parejos)

---

### 1.3 Fallback stability — **P0 ya cerrado + P1 hardening**

**Meta:** fallback confiable y predecible, sin loops raros.

**DoD P0 (ya hecho):**

- Orchestrator integrado al store
- allowFallback solo en arranque
- modo manual/auto soportado

**Hardening P1 recomendado:**

- Tests de “maxAttempts”, “maxAutoFallbacks” y resets
- Métricas/logs estables por intento

📌 Estado actual:

- ✅ Orchestrator funciona y está integrado
- ✅ Fallback modelado dentro del flow (XState)
- 🟡 Hardening de tests aún incompleto

---

### 1.4 Enforcement automático (guardrails) — **P0/P1**

**Meta:** que CI rompa cuando alguien mete una regresión.

**Reglas mínimas que deben fallar en CI:**

- `i18n.t(` fuera del UI layer (incluyendo `payments/shared`, `application`, `infrastructure`)
- `messageKey: this.i18n.t(` en cualquier archivo
- `messageKey: 'texto plano'` en tests (si decides reforzar shape)

📌 Estado actual:

- ✅ depcruise existe para boundaries generales
- ✅ Guardrails de i18n/messageKey agregados en tests (incluye specs fuera de UI y prohibe literals)

---

### 1.5 Tests mínimos por gateway — **P1**

**Meta:** reducir bugs de integración por provider.

**Estándar mínimo por operación crítica:**

- happy path
- invalid request (si aplica)
- provider error → PaymentError normalizado
- mapping correcto

📌 Estado actual:

- 🟡 Hay specs con happy path + provider error, pero el coverage aún es inconsistente.

---

## 2) Definition of Done — Stabilization v3

Puedes marcar “cerrado” cuando todo esto sea cierto:

- ✅ PaymentError viaja solo como `messageKey + params (+ raw)`
- ✅ UI-only translation (definición por UI layer)
- ✅ No existe rendering legacy de errores (`message` crudo)
- ✅ Fallback policy estable y cubierta por tests mínimos
- ✅ Providers parity (Stripe/PayPal) estable
- ✅ Guardrails en CI (enforcement automático)
- 🟡 Tests mínimos por gateway (al menos en las operaciones más usadas)
- ✅ XState integrado como source of truth + store projection

---

## 3) Checklist final (para que sea fácil cerrar)

### P0 — Bloqueadores

- [x] Matar legacy error rendering (`message`)
- [x] Eliminar `messageKey` traducido (y texto literal en specs)
- [x] Agregar enforcement mínimo (scan tests / lint)

### P1 — Estabilidad

- [ ] Completar tests mínimos por gateway crítico
- [ ] Hardening de fallback (attempt counters + auto fallback limits)

### P2 — Refinamientos

- [ ] Reubicar base ports con HttpClient fuera de application (si decides)
- [ ] Tipado más fuerte para `messageKey`
- [x] Preparación para XState (actors/events mapping)
