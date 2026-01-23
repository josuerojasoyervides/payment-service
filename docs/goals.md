# Payments Module — Goals & Evolution Plan (NgRx Signals + XState)

> **Última actualización:** 2026-01-23  
> Documento estratégico: define **por qué** existe este módulo, qué estamos optimizando, y cómo vamos a evolucionar el diseño sin romperlo.

---

## 1) Propósito del proyecto

Este repositorio existe para practicar arquitectura real aplicada a pagos (no sólo “que funcione”).

Queremos que el módulo:

- Sea **extensible** para agregar providers y métodos sin tocar todo el sistema.
- Sea **estable** (tests confiables, flujos sin estados zombies, errores normalizados).
- Sirva como laboratorio para aprender **Clean-ish Architecture pragmática**.
- Pueda crecer hacia algo usable **sin entrar en sobre-diseño enterprise**.

---

## 2) Estado actual (real)

- Store principal: **NgRx Signals**
- Flow: **stateful**
- Estado de pago (macro):
  - `idle → creating_intent → requires_action → confirming → succeeded/failed`
- UI inicia acciones, pero el flow real lo controlan:
  - `PaymentsStore` + `FallbackOrchestratorService`
- Objetivo i18n/errores: **UI-only translation**

---

## 3) Principios de evolución

### 3.1 Lo que no vamos a sacrificar

- Boundaries por capas (domain/app/infra/ui)
- Normalización de errores a un contrato único (`PaymentError`)
- UI como capa de presentación (no orquesta lógica)
- Providers agregables vía registry/factories

### 3.2 Lo que sí vamos a permitir (pragmatismo)

- Angular DI / RxJS dentro de Application
- Doble API temporal (legacy + refactor) **si está claramente documentada**
- Estrategias por método de pago (card/spei) en `shared/`

---

## 4) Target architecture: Ports & Adapters + XState

### 4.1 Ports & Adapters (estándar)

- Domain define modelos/contratos puros.
- Application coordina (use cases, store, orchestrator).
- Infrastructure implementa adapters (Stripe/PayPal/etc).
- UI consume estado y traduce.

### 4.2 Por qué XState en este proyecto

XState se usará como **motor del lifecycle** del pago porque el flow se vuelve difícil de mantener sólo con:

- señales + efectos + rxMethods
- múltiples providers
- fallback manual/auto
- retries/timeouts
- estados intermedios como `requires_action`

Con XState buscamos:

- flujo explícito (statechart real)
- transiciones auditables (eventos claros)
- side effects controlados (invokes/actors)
- menos estados “fantasma” y loops

---

## 5) Coexistencia: NgRx Signals + XState (intención)

✅ Lo que se queda en NgRx Signals:

- historial
- estado actual (view model)
- computed/derived state para UI
- caching ligero de UI

✅ Lo que migra a XState:

- flow intent/confirm
- fallback (manual/auto)
- retries/resiliencia (límites, backoff/timeout)

Regla:

- XState es el **motor de transición**
- NgRx Signals es el **state store observable y derivado para UI**

---

## 6) Definition of Done (pre‑XState)

Antes de meter XState, este repo debe estar en un estado “estable y coherente”.

### ✅ DoD mínimo

1. **PaymentError es contrato final**
   - `messageKey` SIEMPRE es una key i18n
   - `params` para interpolación
   - UI-only translation

2. **Providers consistentes**
   - Stripe y PayPal siguen el estándar “Gateway + Operations”
   - cada operación normaliza error y retorna domain models

3. **Fallback estable**
   - no hay loops
   - eventos expirados no rompen el flow
   - UI nunca se queda colgada

4. **Tests base pasando**
   - gateways: happy path + invalid request + provider error + normalize
   - store/orchestrator: no estados zombies

5. **Docs alineados**
   - reglas y naming reflejan el código real

---

## 7) Roadmap incremental (sin reescritura)

### Fase A — cerrar el ciclo i18n/errores (P0)

- eliminar cualquier legacy que permita `messageKey` ≠ key i18n
- enforcement automático (lint/test)

### Fase B — unificar providers (P1)

- refactor PayPal a “operations”
- estandarizar responses (domain models) y errores

### Fase C — meter XState (P1/P2)

- introducir statechart de pagos (intent/confirm + requires_action)
- integrar XState como motor del flow
- mantener NgRx Signals como state + history

---

## 8) Métricas de éxito (qué significa “mejor”)

- cambios de provider sin tocar UI
- agregar un método sin tocar 8 archivos
- errores siempre renderizan igual (messageKey+params)
- fallback predecible, sin loops
- tests detectan regresiones rápido
