# Payments Module — Goals & Evolution Plan (NgRx Signals → XState)

> **Última revisión:** 2026-01-26  
> Documento estratégico: define **por qué** existe este módulo, cuál es el **North Star**, y cómo evolucionar el diseño sin romper lo que ya funciona.

## Cómo usar este doc

- **Esto NO es “estado del sprint”.**  
  Es una guía + historial de intención.
- Cuando el código se aleje del North Star, este doc debe:
  - registrar la desviación,
  - explicar por qué se aceptó,
  - y definir el “cierre” (cómo se vuelve a alinear).

---

## 1) Propósito del proyecto

Este repositorio existe para practicar arquitectura real aplicada a pagos (no solo “que funcione”).

Buscamos que el módulo:

- Sea **extensible** para agregar providers y métodos sin tocar todo el sistema.
- Sea **estable** (tests confiables, flujos sin estados zombies, errores normalizados).
- Sea **mantenible** (boundaries claros; refactors sin efecto dominó).
- Sea un laboratorio para aprender **Clean-ish Architecture pragmática**.

---

## 2) North Star (end‑state deseado)

### 2.1 Soporte real multi‑provider

- Stripe + PayPal (mínimo)
- Facilitar agregar:
  - SPEI / transferencias
  - wallets
  - providers alternos

**North Star:** agregar un provider nuevo debería ser:

- implementar operaciones/gateways + mapping
- registrarlo en config
- agregar tests mínimos
- sin tocar UI/store en 20 lugares

---

### 2.2 Contrato de errores estable (PaymentError)

**North Star:**

- Infra/App retornan `PaymentError` con:
  - `code`
  - `messageKey`
  - `params`
  - `raw` (debug)
- UI es el único lugar que traduce.

---

### 2.3 Estado/flujo robusto (XState)

**Razón:**
En pagos hay demasiados estados intermedios reales:

- 3DS / requires_action
- redirect approval (PayPal)
- callbacks
- polling de status
- retries/timeouts
- transiciones incompletas

**North Star con XState:**

- flujo explícito (statechart real)
- transiciones auditables (eventos claros)
- side effects controlados (invokes/actors)
- menos estados “fantasma” y loops

---

## 3) Coexistencia: NgRx Signals + XState (estado actual)

✅ Lo que se queda en NgRx Signals:

- estado de UI/pantallas
- data shape para components
- API pública de lectura (selectors)

✅ Lo que vive en XState:

- lifecycle de un pago (start → action → confirm/cancel → polling → done/fail)
- branching por provider/método
- recovery paths (fallback, refresh, cancel)

📌 Estado actual:

- XState es la fuente de verdad del flujo.
- Store es proyección del snapshot (sin orquestación).
- Fallback se modela dentro del flow y usa el orchestrator como policy/telemetría.

---

## 4) Roadmap por fases (incremental, sin reescrituras)

### Fase A — Estabilización & consistencia (P0/P1)

**Objetivo:** que el módulo sea confiable y consistente antes de meter flow complejo.

**Definition of Done (North Star de la fase A):**

- PaymentError solo viaja como `messageKey + params (+ raw)`
- UI-only translation (definición por “UI layer”, no por folder literal)
- Fallback policy estable y testeado
- Providers con el mismo patrón (facade + operations)
- Tests mínimos en gateways críticos

📌 Estado actual (as-of 2026-01-26):

- ✅ Providers ya están estandarizados
- ✅ Fallback orchestrator integrado
- ✅ PaymentError contract existe
- ✅ Enforcement automático agregado
- 🟡 Tests mínimos por gateway aún incompletos

---

### Fase B — Hardening (enforcement + CI) (P1)

**Objetivo:** evitar regresiones sin depender de disciplina manual.

Targets:

- test/lint que falle si hay `i18n.t(` fuera de UI layer
- test/lint que falle si `messageKey` se usa como texto traducido
- depcruise consolidado con reglas que representen el North Star real

---

### Fase C — XState (P2)

**Objetivo:** migrar el “pago como workflow” a máquina de estados.

Targets:

- definir flow completo en statechart
- mantener el store como puente (sin romper UI)
- fallback modelado como estados del flow

---

## 5) Métricas de éxito (lo que importa)

- Agregar un provider nuevo sin tocar UI/store a lo loco ✅
- Reducir bugs de estados zombies ✅
- Errores consistentes y traducidos solo en UI ✅
- Refactors sin romper tests ✅
- La UI no necesita saber “cómo” se paga, solo “qué estado mostrar” ✅

---

## 6) Deuda aceptada (registrada)

Esto no es “malo”, es deuda consciente (pero debe tener plan):

- Legacy rendering de `PaymentError.message` (debe morir)
- Algunos specs con `messageKey` como texto (debe corregirse)
- Abstract ports con HttpClient en application (decidir si se migra a infra/base)

---

## 7) Próximo cierre recomendado (el siguiente “checkpoint” real)

Si hoy tuvieras que cerrar un ciclo completo, sería:

1. **Completar tests mínimos en gateways críticos**
2. **Hardening de fallback** (attempt counters + auto fallback limits)
3. **Reubicar base ports con HttpClient** si se decide cerrar esa deuda
