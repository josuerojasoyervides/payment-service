# Payments Module — Goals & Evolution Plan (NgRx Signals + XState)

> Documento estratégico. Define **por qué** existe este módulo, qué buscamos aprender, y cómo vamos a evolucionar el diseño sin romperlo.

## 1) Propósito del proyecto

Este repositorio existe para practicar arquitectura real aplicada a pagos (no sólo “que funcione”).

Queremos que el módulo:

- Sea **extensible** para agregar providers y métodos sin tocar todo el sistema.
- Sea **estable** (tests confiables, flujos sin estados fantasmas, errores normalizados).
- Sirva como “laboratorio” para aprender **Clean-ish Architecture pragmática**.
- Pueda crecer hacia algo usable **sin entrar en sobre-diseño enterprise**.

## 2) Principios de evolución (cómo vamos a crecer)

Reglas del juego:

- ✅ Cambios incrementales, con pasos pequeños y reversibles.
- ✅ No big-bang rewrite.
- ✅ Mantener el foco didáctico y la claridad conceptual.
- ✅ Mejorar primero **estabilidad, trazabilidad y separación de responsabilidades**.
- ❌ No agregar frameworks nuevos por moda.
- ❌ No esconder complejidad real con “magic abstractions”.

## 3) Motivación del cambio: por qué meter XState

Actualmente el flujo del pago (y el fallback) se resuelve con:

- estados coarse en el store (`idle/loading/ready/error`),
- lógica distribuida entre store + use cases + orchestrator,
- “señales implícitas” (flags, ifs cruzados, estados derivados por casualidad).

Esto escala mal cuando quieres soportar variaciones reales:

- `requires_action` (3DS o SPEI)
- `processing` (espera backend / polling)
- `awaiting_confirmation` (usuario confirma)
- cancelación del usuario
- expiración del intento
- retries con límites
- timeout de UI / gateway
- fallback manual vs automático
- “reintento con otro provider” sin loops ni estados zombies

### Qué nos aporta XState (en este proyecto)

XState se usará como **motor del lifecycle** del pago.

- El flujo pasa a ser **explícito** (statechart claro).
- Cada transición tiene una razón y un evento.
- Los side effects se encapsulan con “invoke” (sin ifs desperdigados).
- Es más fácil testear **secuencias de eventos** que “métodos sueltos”.
- Se reduce el riesgo de “estado colgado” porque el flujo queda modelado.

> XState aquí no es por trendy. Es para que el flujo sea mantenible cuando se vuelva realista.

## 4) Qué NO se va a mover a XState (importante)

XState NO es el lugar para meter todo.

Se quedan fuera (y deben seguir siendo responsabilidades separadas):

- **Gateways** (Stripe/PayPal/etc.): HTTP + mapping + normalización de errores del provider.
- **ProviderFactoryRegistry** y factories: descubrimiento y composición (family of objects).
- **Request Builders**: construcción/validación del `CreatePaymentRequest`.
- **Core transversal**: logging, caching, resilience, i18n.
- **NgRx Signals**: estado observable para UI, historial, selectores derivados, debug.

## 5) Cómo convivirá todo (arquitectura objetivo)

### 5.1 XState = flujo

- `PaymentFlowMachine` define estados y transiciones del lifecycle.
- Mantiene **context mínimo**: provider actual, request actual, intent actual, intentId, reason/error normalizado, timers.

### 5.2 Use cases = efectos / side effects

- `StartPaymentUseCase` / `ConfirmPaymentUseCase` / `CancelPaymentUseCase` / `GetPaymentStatusUseCase`
- NO deciden el flujo.
- Solo ejecutan la operación (gateway/strategy) y retornan resultado o error normalizado.

### 5.3 NgRx Signals = proyección para UI

- El store deja de “inventarse el flow”.
- El store se vuelve un **proyector** del snapshot de XState:
  - status para UI (`loading/ready/error/...`)
  - flags derivados (`requiresUserAction`, `isProcessing`, etc.)
  - historial de intents (auditoría/debug)
  - estado de fallback visible (pending, executing, etc.)

### 5.4 Core transversal

- `LoggerService` y resilience/caching se usan desde gateway y/o use cases (sin contaminar Domain).
- XState solo “llama” al caso de uso y registra eventos de alto nivel.

## 6) Problemas actuales que XState debe resolver

Esta lista es el “why” del cambio (si no se cumple, XState no aporta):

1. **Estados implícitos**
   - Evitar que `loading` signifique 4 cosas distintas.

2. **Fallback sin loops ni estados zombies**
   - Autocomplete en modo auto.
   - Manual con timeout y cancelación.
   - No disparar startPayment infinitamente.

3. **Separación clara UI vs Flow**
   - UI observa y envía eventos.
   - UI no toma decisiones de flujo (“si pasa X entonces Y”) fuera de la máquina.

4. **Retry/timeout/cancelación**
   - Reglas explícitas: cuántos retries, cuándo expira, cuándo deja de intentar.

5. **Trazabilidad**
   - Un timeline claro de eventos: `START` → `INTENT_CREATED` → `REQUIRES_ACTION` → `CONFIRMED` → `SUCCEEDED`, etc.

## 7) Metas incrementales (sin big-bang)

### Milestone 0 — Alinear contratos y semántica (cero XState aún)

- Definir 1 sola semántica de `PaymentError` (message vs messageKey).
- Alinear fallback trigger codes con `PaymentErrorCode`.
- Reducir inconsistencias de i18n (no doble traducción).
- Minimizar barrels en Domain (o aceptar explícitamente la decisión).

### Milestone 1 — Esqueleto de máquina (paralela, sin reemplazar store)

- Crear `PaymentFlowMachine` con estados mínimos:
  - `idle → starting → success/error`
- Integrar solo para `startPayment` en modo “shadow”: el store sigue funcionando pero ya hay un actor.

### Milestone 2 — Lifecycle real (requires_action / processing / awaiting_confirmation)

- Expandir a:
  - `starting → processing → requires_action → awaiting_confirmation → succeeded/failed`
- Mapear snapshots a UI signals.
- Integración con `NextAction` (3DS y SPEI) sin hacks.

### Milestone 3 — Fallback dentro del flow (manual/auto)

- Transiciones explícitas:
  - `failure → fallback_pending` (manual)
  - `failure → fallback_auto` (auto)
- Integrar con policy del orchestrator o absorberla dentro del machine (gradual).

### Milestone 4 — Retry/timeout/cancel/expire

- Reglas explícitas y testeables.
- Eventos: `RETRY`, `TIMEOUT`, `CANCEL`, `EXPIRE`.

### Milestone 5 — Simplificar store al mínimo

- Store como “projection + history”.
- Remover decisiones de flujo del store.
- Los use cases ya no “ocultan” fallback devolviendo `EMPTY`.

## 8) Señales de éxito (cómo sabremos que mejoró)

- La UI puede describir el estado con una sola fuente de verdad (snapshot de XState).
- No hay “loading infinito”.
- Fallback es determinístico (sin loops raros).
- Agregar un provider nuevo no toca el flow (solo se conecta a factory + gateway + strategies).
- Tests verifican secuencias de eventos, no “ifs”.

---
