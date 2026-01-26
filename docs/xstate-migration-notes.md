# Payments Module — Migración de Store (NgRx Signals) a XState

> Documento vivo: transición completa, lo que ya se hizo y el plan para cerrar la integración.

Este documento compara **dos snapshots del proyecto**:

- **Base (rama `dev`)**: `payment-service-dev.zip`
- **Actual (feature XState)**: `payment-service-feat-xstate-refresh-from-idle.zip`

El objetivo es documentar **todo el progreso** de la transición del store original (que mezclaba responsabilidades) hacia una implementación con **XState como orquestador del flujo**, manteniendo el store como **API pública / adapter** durante la fase híbrida.

---

## 1) Qué problema resuelve XState aquí

Tu módulo de pagos tiene un “flujo” real (no solo estado UI):

- seleccionar provider
- construir request
- start → confirm / redirect / polling
- errores (retryable / no retryable)
- fallback manual/auto
- reset y reintentos

El store original hace demasiadas cosas a la vez, lo cual típicamente trae:

- transiciones implícitas (difícil “ver” el flujo)
- side effects mezclados con mutación de estado
- pruebas de integración frágiles (timeouts / race conditions)
- difícil separar “qué pasó” vs “por qué pasó”

**XState** te da:

- **un grafo explícito** de estados / eventos
- “happy path” y “error path” modelados con claridad
- side effects encapsulados en `invoke` / `actors`
- tags (`loading`, `ready`, etc.) para que UI tenga selectores estables

---

## 2) Snapshot A (rama `dev`): cómo se veía el store antes de XState

### 2.1 Estructura de store

Archivo principal:

- `src/app/features/payments/application/store/payment-store.ts`

Patrón:

- `signalStore(...)`
- `createPaymentsStoreActions(...)`
- `buildPaymentsSelectors(...)`

El store está organizado en módulos para mantener legible el archivo, pero **la orquestación seguía viviendo en el store**.

### 2.2 Responsabilidades principales del store (antes)

En `dev`, el store típicamente era responsable de:

1. **Estado UI/Flow**

- `isLoading`, `isReady`, `hasError`, etc. (directo o derivado)
- `intent`, `providerId`, `request`, `flowContext`, `error`, `history`

2. **Orquestación async**

- start / confirm / cancel / getStatus
- encadenar pasos del flujo
- decidir “qué sigue” dependiendo del resultado

3. **Fallback & recovery**

- lógica de fallback (manual/auto)
- decisión de “reintentar / cambiar provider”
- reset / clear / rehydrate

4. **Logging / telemetry**

- logs desde store y desde gateways/strategies
- tracking de flows con correlación

✅ Esto funcionaba, pero era un **núcleo muy pesado**: el store era casi “el state machine”, solo que implícito.

---

## 3) Snapshot B (feature XState): qué ya está implementado

### 3.1 Archivos nuevos clave

En la rama feature aparece el módulo de XState:

- `src/app/features/payments/application/flow/payment-flow.machine.ts`
- `src/app/features/payments/application/flow/payment-flow.actor.service.ts`
- `src/app/features/payments/application/flow/payment-store.machine-bridge.ts`
- `src/app/features/payments/application/flow/payment-flow.types.ts`
- `src/app/features/payments/application/flow/payment-flow.guards.ts`

Y se actualiza el store:

- `src/app/features/payments/application/store/payment-store.ts`
- `src/app/features/payments/application/store/payment-store.actions.ts`

### 3.2 PaymentFlowMachine (la “verdad” del flujo)

En `payment-flow.machine.ts` ya existe una máquina con estados importantes como:

- `idle`
- `starting` → `afterStart`
- `confirming` → `afterConfirm`
- `polling`
- `requiresAction`
- `success`
- `error`

Además, se metieron **tags** para que UI y el store puedan depender de ellos:

```ts
idle: { tags: ['idle'] },
loading: {
  tags: ['loading'],
  states: { ... }
},
ready: { tags: ['ready'] },
error: { tags: ['error'] },
```

Y desde UI puedes checar con:

```ts
snapshot.hasTag('loading');
snapshot.hasTag('ready');
```

Esto es clave porque evita que UI dependa de “nombres” de estados internos.

### 3.3 PaymentFlowActorService (wrapper Angular-friendly)

`payment-flow.actor.service.ts`:

- inyecta use cases (`StartPaymentUseCase`, `ConfirmPaymentUseCase`, etc.)
- crea el actor `createActor(machine, { inspect })`
- sincroniza el snapshot a un `Signal<PaymentFlowSnapshot>`
- se detiene con `DestroyRef.onDestroy()`
- hace logging “bonito” por transición (evento + state + context + correlationId)

**Resultado:** tienes un “runtime de XState” viviendo como servicio Angular.

### 3.4 Machine Bridge (store ⇄ machine) ✅

`payment-store.machine-bridge.ts` implementa un concepto súper bueno:

- **el store sigue siendo el API público**
- XState es el “motor”
- el bridge “pinta” el estado del store a partir del snapshot

En tests ya se ve:

```
[BRIDGE] state: idle context: { ... }
```

Con esto logras:

- mantener componentes y selectors existentes funcionando
- migrar paso a paso sin reventar todo el módulo

### 3.5 Store Actions en modo híbrido (“legacy + machine”)

En `payment-store.actions.ts` (feature) ya hay lógica de:

- intentar mandar evento a la máquina (`stateMachine.send(...)`)
- **si la máquina lo acepta**, el store se actualiza vía bridge
- **si no lo acepta**, todavía existe un “legacy path” de respaldo

Ejemplo (simplificado):

- `startPayment(...)` → manda evento
- si XState lo rechazó, entonces usa `legacyStartPayment(...)`

Esto te permitió **pasar tests** sin hacer migración big-bang.

---

## 4) Qué se logró (en términos de arquitectura)

### ✅ Logros reales

- El flujo de pagos ya tiene un “cerebro” explícito (XState)
- Ya existe instrumentación por transición (`inspect`)
- Ya tienes compatibilidad con el store actual
- UI puede depender de tags estables (`loading`, `ready`, etc.)
- Se resolvió el tema de tests que se quedaban en `isLoading: true` (se nota por el branch _refresh-from-idle_)

### ✅ Logro más importante

Ya existe un camino para:

- dejar el store como **adapter / facade**
- y mover el “core flow” al state machine

---

## 5) Qué falta para decir “XState está completo a la par del store”

Ahora mismo estás en una fase **híbrida**.

El “completo a la par del store” significa:

1. Todo el flujo crítico se dispara por eventos en la máquina
2. El store ya **no orquesta** (solo refleja + expone API)
3. Los componentes UI solo hablan con el store (o con el actor, si decides)
4. El fallback se modela como estados del flujo, no como lógica paralela

---

## 6) Roadmap recomendado (para terminar la implementación)

### Fase 1 — Consolidar el contrato de eventos (1 día)

Asegura que el store solo llama eventos “públicos”:

- `START({ providerId, request, flowContext })`
- `CONFIRM({ providerId, intentId })`
- `CANCEL({ providerId, intentId })`
- `REFRESH({ providerId, intentId })`
- `RESET()`
- `SELECT_PROVIDER({ providerId })`
- `SET_REQUEST({ request, flowContext })`

✅ Regla de oro:  
**los componentes NO deben invocar use cases directamente**.

---

### Fase 2 — Mover side-effects 100% a XState (1–2 días)

En lugar de `legacyStartPayment`, todo se vuelve `invoke`:

- `starting.invoke.startPayment`
- `confirming.invoke.confirmPayment`
- `polling.invoke.getStatus`

La máquina debe ser la dueña de:

- cuándo se llama cada use case
- cómo se manejan errores
- cómo se hace retry/backoff (si aplica)
- cuándo se transiciona a `requiresAction` o `success`

---

### Fase 3 — “Store becomes a projection” (1 día)

Aquí el store se vuelve literal un espejo del snapshot:

- `_snapshot` se vuelve la fuente para `isLoading/isReady/error/intent/...`
- se elimina mutación manual de esas banderas
- el bridge aplica un `mapSnapshotToStoreState(snapshot)`

Idealmente:

- el store tiene 0 lógica de negocio
- solo `send(event)` + selectors

---

### Fase 4 — Integrar fallback como estado (1–2 días)

Hoy el fallback vive en `payment-store.fallback.ts`.

Para integración completa:

- fallback se modela como estados/sub-estados, por ejemplo:

- `error.retryable` → `fallbackCandidate`
- `fallbackCandidate.auto` / `fallbackCandidate.manual`

Eventos sugeridos:

- `FALLBACK_REQUESTED`
- `FALLBACK_PROVIDER_SELECTED`
- `FALLBACK_EXECUTE`

✅ Beneficio: el fallback deja de ser “un mundo paralelo”.

---

### Fase 5 — Test strategy nueva (1–2 días)

Separar pruebas en 3 niveles:

1. **Machine unit tests**

- transición por eventos
- asserts de `state.value`, `tags`, `context`

2. **Store bridge tests**

- al recibir snapshots, store refleja bien

3. **UI integration tests**

- “user flow” completo con fake gateways

✅ Para estabilidad:

- usar fake timers donde aplique
- evitar waits “por tiempo”; preferir “wait until state/tag”

---

## 7) Indicadores de “ya terminamos la migración”

Checklist:

- [ ] no existe `legacyStartPayment / legacyConfirm / legacyCancel / legacyGetStatus`
- [ ] el store no llama use cases
- [ ] todo flujo se dispara por eventos XState
- [ ] UI depende de tags (loading/ready/error) y data de snapshot/store
- [ ] fallback está modelado dentro de machine
- [ ] las pruebas unitarias de machine cubren rutas principales
- [ ] timeouts en integración desaparecen o bajan muchísimo

---

## 8) Próximas tareas concretas (orden sugerido)

1. **Cerrar loop de START → READY**

- que el `starting` siempre termine en `ready|requiresAction|error`
- evitar quedarse “colgado” en loading

2. **Modelar `refresh-from-idle` oficialmente**

- si en `idle` existe `intentId`, entonces `REFRESH` debe llevar a `polling`

3. **Unificar history**

- si history vive en store, que se actualice desde machine transitions
- o mover history a context del machine y proyectarlo

4. **Eliminar duplicación de “source of truth”**

- evitar tener `isLoading` tanto en store como en machine
- usar tags como verdad y store solo los expone

---

## Notas rápidas de observabilidad

Tu logging actual ya está muy bien encaminado:

- `inspect` del actor con snapshots
- correlationId por transición
- logs de gateways/strategies

Lo que sigue sería:

- estandarizar payloads (event/state/context)
- decidir “quién es el owner” del correlation lifecycle (store vs actor service)

---

## Apéndice — Archivos revisados en esta comparación

**Store (dev)**

- `payment-store.ts`
- `payment-store.actions.ts`
- `payment-store.selectors.ts`
- `payment-store.fallback.ts`

**XState (feature)**

- `payment-flow.machine.ts`
- `payment-flow.actor.service.ts`
- `payment-store.machine-bridge.ts`
- `payment-flow.types.ts`
- `payment-flow.guards.ts`
- `payment-store.actions.ts` (modo híbrido)

---
