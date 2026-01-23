# Stabilization Plan — v2 (post refactor + antes de XState)

> Objetivo: **estabilizar** lo que ya existe, cerrar inconsistencias y dejar el terreno listo para migrar el flow complejo a XState **sin reescrituras**.

---

## 0) Estado actual (snapshot real)

✅ Ya existen piezas clave que valen oro y NO hay que romper:

- `ProviderFactoryRegistry` como única entrada a providers
- `ProviderFactory.getGateway()` ya está implementado
- Use cases separados por operación (start/confirm/cancel/get)
- `PaymentsStore` reducido (rxMethods cortos)
- `PaymentStatePort` + `PAYMENT_STATE` token (UI desacoplada del store)
- `FallbackOrchestratorService` con estado + eventos (manual/auto)
- Infra Stripe basada en “operations + facade” (IntentFacade)
- Infra PayPal operando como “legacy gateway” (BasePaymentGateway)

⚠️ Pero hay inconsistencias que hoy son deuda encubierta:

- Documentación vs código (reglas de Domain, error model, i18n)
- Domain usa `Observable` + barrels (`index.ts`) aunque las reglas lo prohíben
- `PaymentError` en código no tiene `messageKey/providerId/stacks` como la regla sugiere
- UI traduce strings “ya traducidas” (doble i18n)
- Fallback config tiene trigger codes que no existen en `PaymentErrorCode`
- Confirm/Cancel/Get reportan failure con un request “dummy” (señal de API incorrecta)
- StartPaymentUseCase puede devolver `EMPTY` → store se queda en `loading` mientras fallback decide (funciona, pero es frágil)

---

## 1) Qué ya se puede marcar como HECHO ✅

### 1.1 Boundaries base (capas)

- [x] Carpeta por capa: `domain / application / infrastructure / shared / ui`
- [x] UI depende de `PAYMENT_STATE` + `ProviderFactoryRegistry` (no usa infraestructura directo)
- [x] Use cases viven en `application/use-cases`

### 1.2 Registry + factories

- [x] Registry central (`ProviderFactoryRegistry`)
- [x] Factories registradas vía token multi (`PAYMENT_PROVIDER_FACTORIES`)
- [x] `getGateway()` existe y se usa en confirm/cancel/get

### 1.3 Fallback

- [x] `FallbackOrchestratorService` controla estado (`FallbackState`) y eventos
- [x] Store refleja fallback state y expone `executeFallback/cancelFallback`
- [x] Soporta “manual vs auto” (aunque aún hay aristas)

---

## 2) Tareas de estabilización pendientes (sin XState todavía)

> Aquí no tocamos arquitectura mayor: sólo arreglamos inconsistencias para que la migración sea limpia.

### 2.1 Alinear “source of truth”: reglas vs implementación

- [ ] Decidir explícitamente qué significa `domain` en este repo:
  - Opción A: “Domain puro” (sin RxJS) ⇒ mover ports a `application/ports`
  - Opción B (más realista hoy): “Domain = contratos del módulo” ⇒ permitir RxJS en ports y ajustar `payments-architecture-rules.md`
- [ ] Resolver barrels:
  - Si se mantienen, documentarlo como excepción intencional.
  - Si se eliminan, hacerlo incremental (sin refactor masivo).

**Criterio de éxito:** documento y árbol del proyecto ya no se contradicen.

### 2.2 `PaymentError`: una sola semántica, sin ambigüedad

- [ ] Elegir “message vs messageKey”
  - Recomendación: `messageKey` + `params` (y UI traduce)
  - Alternativa: `message` ya listo (y UI no traduce)
- [ ] Alinear `DEFAULT_FALLBACK_CONFIG.triggerErrorCodes` con `PaymentErrorCode`
- [ ] Centralizar normalización en 1 lugar (helper) para evitar isPaymentError ad-hoc

**Criterio de éxito:** ningún layer “inventa” errores; todos hablan el mismo idioma.

### 2.3 Unificar patrón de gateways (Stripe vs PayPal)

- [ ] Definir qué patrón queda como estándar:
  - “Operations + Facade” (Stripe) **vs**
  - “BasePaymentGateway” (PayPal)
- [ ] No reescribir todo: solo elegir el estándar y adaptar el otro provider cuando toque.

**Criterio de éxito:** agregar un provider nuevo no implica decidir arquitectura cada vez.

### 2.4 Clarificar responsabilidades de i18n

- [ ] Si `FieldRequirements` ya regresa texto traducido, eliminar traducción duplicada en UI.
- [ ] Si `FieldRequirements` debe devolver keys, cambiar factories para exponer keys y UI traducir.

**Criterio de éxito:** una sola capa traduce.

### 2.5 API del fallback: eliminar “request dummy”

- [ ] Ajustar el contrato de `FallbackOrchestratorService.reportFailure(...)` para que soporte operaciones no-start:
  - Opción: `reportFailure({ providerId, error, request?: CreatePaymentRequest })`
  - O “reportPaymentFailure” vs “reportGatewayFailure”
- [ ] Confirm/Cancel/Get no deben inventar un request fake.

**Criterio de éxito:** la API expresa la intención real.

### 2.6 “Loading infinito” controlado

- [ ] Definir estado UI explícito cuando hay fallback pending
  - hoy: status queda `loading` y fallback.status=`pending`
  - mejorar: derivar un “uiStatus” o mínimo, ajustar UI para no bloquear.
- [ ] Asegurar que `startPayment` siempre termina en algún estado observable.

**Criterio de éxito:** no hay pantallas colgadas sin explicación.

---

## 3) Plan incremental para introducir XState (después de 2.x)

### 3.1 Objetivo mínimo del primer release con XState

No es “migrar todo”; es:

- Tener **una máquina** que modele el lifecycle real.
- Que el store sea una **proyección** (snapshot → signals).
- Que use cases sigan siendo el “motor de efectos”.

### 3.2 Orden recomendado (corto y seguro)

- [ ] Crear `PaymentFlowMachine` con estados mínimos:
  - `idle → starting → succeeded/failed`
- [ ] Conectar únicamente `startPayment` como primer caso
- [ ] Exponer snapshot a través del store (sin romper UI)
- [ ] Expandir estados:
  - `processing / requires_action / awaiting_confirmation`
- [ ] Integrar fallback como transiciones explícitas (manual/auto)
- [ ] Agregar cancel/timeout/expire/retry

### 3.3 Qué NO debe pasar en esta fase

- ❌ Reemplazar NgRx Signals por otra cosa
- ❌ Meter datos pesados al context de la máquina “porque sí”
- ❌ Convertir el proyecto en un framework dentro de otro

---

## 4) Checklist final de estabilización (antes de “feature work”)

- [ ] Tests verdes y con nombres claros (unit + integración donde aplique)
- [ ] 1 semántica de error, 1 lugar de normalización
- [ ] 1 patrón estándar de gateway
- [ ] Fallback sin request dummy y sin loops
- [ ] Docs alineadas con código (sin contradicciones)
- [ ] Machine planificada y lista para entrar incrementalmente

---
