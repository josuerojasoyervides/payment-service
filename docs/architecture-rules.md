# Payments Module — Architecture & Quality Rules

> **Última revisión:** 2026-01-24  
> Este repo es un laboratorio para practicar arquitectura aplicada a pagos **sin convertirlo en una telaraña**.

## Cómo leer este documento (importante)

Este doc cumple 2 roles al mismo tiempo:

1. **North Star (guía)** — cómo _debería_ verse el módulo cuando esté “bien cerrado”.
2. **Snapshot (historial)** — qué cosas ya están aplicadas hoy, qué está a medias y qué es deuda aceptada temporalmente.

➡️ Por eso vas a ver secciones con:

- **✅ Regla (target)**
- **📌 Estado actual (as‑of 2026-01-24)**
- **🧾 Desviación aceptada** (si existe) + **plan de cierre**

---

## 0) Capas del módulo (target)

> **Objetivo:** acoplamiento mínimo + evolución incremental.

**Capas (feature `payments/`):**

- `domain/` → modelos, tipos, factories, reglas puras TS.
- `application/` → casos de uso, puertos, servicios de orquestación (sin UI).
- `infrastructure/` → integración con providers (Stripe/PayPal), mapping, DTOs.
- `shared/` → utilidades compartidas del feature **que NO son UI** (helpers, mappers neutrales).
- `ui/` → páginas, componentes, renderers, adapters a la vista.
- `config/` → composición DI del feature (providers, tokens, wiring).

✅ **Regla:** una capa solo puede depender de capas “hacia adentro” (o laterales estrictamente controladas).

📌 **Estado actual:** la estructura ya existe y se respeta globalmente.

---

## 1) Boundaries no negociables

### 1.1 Domain es TS puro

✅ Regla (target)

- `domain/` **no** importa Angular, RxJS, HttpClient, `i18n.t`.
- Solo tipos, factories, validators, normalización de datos **pura**.

📌 Estado actual

- Se cumple.

---

### 1.2 UI nunca orquesta lógica de negocio

✅ Regla (target)

- UI solo:
  - dispara acciones / use cases,
  - renderiza estado,
  - muestra errores traducidos,
  - maneja navegación.

📌 Estado actual

- Se cumple: store/actions + orchestrator llevan el peso.

---

### 1.3 Application no depende de Infrastructure

✅ Regla (target)

- `application/` define contratos (“ports”) y orquestación.
- `infrastructure/` los implementa.

📌 Estado actual

- Se cumple a nivel de imports.

🧾 Desviación aceptada (temporal)

- Hay **abstract base classes con HttpClient** dentro de `application/ports/**` para evitar duplicación de gateways.
- Esto rompe la pureza “ideal” de application.

🎯 Plan de cierre recomendado

- Separar:
  - `application/ports/**` → **solo interfaces**
  - `infrastructure/base/**` → base classes con Angular inject/HttpClient/logger

---

## 2) Dependencias permitidas (mapa rápido)

✅ Regla (target)

- `ui/` → puede importar `application/`, `domain/`, `shared/` (feature), y `src/app/shared/**` (UI global).
- `application/` → puede importar `domain/` y `shared/` (feature).
- `infrastructure/` → puede importar `application/` (ports), `domain/`, `shared/` (feature).
- `shared/` (feature) → puede importar `domain/` únicamente.
- `config/` → puede importar de todas para cablear DI (es composición).

❌ Prohibido

- `domain/` importando Angular/RxJS/HttpClient.
- `ui/` importando `infrastructure/` directamente.
- `shared/` (feature) importando `i18n.t()` o cosas UI.

---

## 3) Providers: contratos y responsabilidades

### 3.1 Qué debe hacer SIEMPRE un gateway (provider)

✅ Regla (target)
Un provider gateway SIEMPRE debe:

- validar request (mínimo sanity check / required fields),
- normalizar errores a `PaymentError` (sin texto traducido),
- mapear DTO → Domain models,
- log/telemetry **sin filtrar datos sensibles**.

Opcional según caso:

- retries/backoff (si la operación lo amerita),
- caching (si el endpoint lo permite),
- timeout / abort.

📌 Estado actual

- En general se cumple.
- Falta estandarizar tests mínimos por gateway (ver §8).

---

### 3.2 Qué está prohibido para providers

❌ Prohibido

- tocar store/UI/router,
- traducir (no `i18n.t`),
- decidir fallback,
- mutar estado global del módulo.

📌 Estado actual

- Se cumple.

---

## 4) Fallback policy

✅ Regla (target)

- El fallback se decide **en Application** (store/orchestrator), nunca en UI o infra.
- El fallback se aplica **solo** a operaciones “arrancables” (ej: `startPayment/createIntent`), no a “confirm/capture” por defecto.

📌 Estado actual

- `FallbackOrchestratorService` existe y está integrado al store.
- `allowFallback: true` solo se usa en el arranque.

---

## 5) I18n & PaymentError (contrato oficial)

### 5.1 UI-only translation (definición correcta)

✅ Regla (target)
`i18n.t(...)` solo se permite dentro del **UI Layer**, que incluye:

- `src/app/features/**/ui/**`
- `src/app/shared/**` _(UI global: navbar, language selector, etc.)_

❌ Prohibido en:

- `domain/`, `application/`, `infrastructure/`
- `src/app/features/**/shared/**` _(shared del feature NO es UI)_

📌 Estado actual

- En `payments/` se cumple (no hay `i18n.t` fuera de `payments/ui/**`).
- En `src/app/shared/**` sí existe traducción (y está permitido por esta regla).

---

### 5.2 Contrato oficial: `PaymentError`

✅ Regla (target)
Los errores viajan como datos estructurados, nunca como texto traducido.

```ts
export type PaymentErrorParams = Record<string, string | number | boolean | null | undefined>;

export interface PaymentError {
  code: string; // código técnico estable (provider + normalizado)
  messageKey: string; // SIEMPRE key i18n (ej: I18nKeys.errors.provider_error)
  params?: PaymentErrorParams; // params serializables para i18n
  raw?: unknown; // error original / metadata para debug
}
```

✅ Reglas fuertes

- `messageKey` **NO es el mensaje** ya traducido.
- `raw` nunca se muestra al usuario (solo debug).
- UI traduce una vez: `i18n.t(error.messageKey, error.params)`.

📌 Estado actual

- Tipo/contrato ya existe y se usa.
- Hay leaks puntuales que deben eliminarse (ver §5.4).

---

### 5.3 Normalización de errores (infra/app)

✅ Regla (target)
Infra y Application deben retornar `PaymentError` con:

- `messageKey: I18nKeys.errors.xxx`
- `params` si aplica

❌ Nunca:

- `messageKey = i18n.t(...)`
- `message = "texto en español"`

📌 Estado actual

- Infra/App retornan keys correctamente.

---

### 5.4 Desviaciones actuales (deuda i18n)

🧾 Deuda conocida (as-of 2026-01-24)

1. **Legacy rendering en UI**  
   Existe compatibilidad para un shape viejo que traía `message` (texto crudo).  
   → Esto contradice el target: “errores siempre como datos”.

2. **`messageKey` convertido a texto traducido en un caso de UI demo/showcase**  
   → Esto rompe el significado de `messageKey`.

3. **Tests usan `messageKey` como texto**  
   → Esto debilita la disciplina del contrato.

🎯 Plan de cierre (P0)

- Eliminar el render legacy de `error.message` (solo traducir por `messageKey`).
- Prohibir `messageKey = i18n.t(...)` (solo keys).
- Arreglar specs que usan texto como key.
- (P1) Agregar enforcement automático (ver §9).

---

## 6) Naming (para no romper consistencia)

✅ Regla (target)

- **Port** = contrato (interface/abstract class) que define el shape.
- **Gateway** = implementación que habla con un provider (Stripe/PayPal).
- **Operation** = unidad atómica de provider (“create/confirm/cancel/getStatus”).
- **Facade** = wrapper por provider que compone operaciones y expone API consistente.
- **Orchestrator** = lógica de coordinación entre providers (fallback, attempts, policies).

📌 Estado actual

- El repo ya usa `facades/`, `gateways/intent/*`, `FallbackOrchestratorService`.

---

## 7) Quality rules (prácticas mínimas)

✅ Regla (target)

- No barrel files globales que escondan boundaries.
- Imports claros por capa.
- Logs con contexto (providerId + operation) y sin secrets.

📌 Estado actual

- Se removieron barrel files antiguos.

---

## 8) Testing rules (mínimo realista)

✅ Regla (target)
Por cada gateway/operación importante debe existir mínimo:

- **happy path**
- **invalid request** (cuando aplique)
- **provider error normalizado** (`PaymentError` correcto)
- **mapping correcto** (DTO → Domain)

📌 Estado actual

- Hay specs, pero varios se quedan en happy path.
- **Decisión:** o subimos los tests, o bajamos el estándar escrito aquí (pero hoy el doc es más estricto que la realidad).

---

## 9) Enforcement automático (recomendado)

✅ Regla (target)
Las reglas NO deben depender de “acordarse”. Deben fallar en CI.

Recomendaciones prácticas:

- Test de escaneo que falle si encuentra `i18n.t(` fuera del UI layer.
- Test de escaneo que falle si encuentra `messageKey: this.i18n.t(`.
- depcruise rule adicional: `application/**` no debe importar `HttpClient` (si decides cerrar esa deuda).

📌 Estado actual

- depcruise ya existe, pero falta enforcement para i18n/messageKey.

---

## 10) Checklist de estabilización (con estado)

### 10.1 Boundaries base

- ✅ Carpeta por capa (`domain / application / infrastructure / shared / ui / config`)
- ✅ Domain TS puro
- ✅ UI no importa infraestructura
- ✅ Application no importa infraestructura

### 10.2 Providers

- ✅ Stripe y PayPal ya siguen el patrón facade + operations
- 🟡 Tests mínimos por gateway (faltan casos de error/invalid request en varios)

### 10.3 I18n & errores

- ✅ UI-only translation (UI layer definido correctamente)
- ✅ PaymentError = messageKey + params (+ raw)
- 🟡 Hay deuda legacy (`error.message`) y leaks de `messageKey` con texto
- ❌ Enforcement automático (lint/test) pendiente

### 10.4 Fallback

- ✅ Orchestrator integrado y estable
- ✅ allowFallback solo en “arranque”
- ✅ modo manual/auto configurado y aislado

---

## 11) “No inventar” — reglas de mantenimiento del doc

✅ Regla

- Si una regla ya no describe la realidad, se marca como:
  - **North Star** (target) + **deuda** (por qué aún no está),
  - o se elimina si dejó de tener sentido.
- Cada cierre grande deja un “changelog” corto al inicio.
