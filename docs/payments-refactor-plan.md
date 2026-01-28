# Payments Refactor Plan & Folder Organization Guide (sin `index.ts`)

Este documento define la **estructura final objetivo** del feature `payments`, las **convenciones de nomenclatura**, las **intenciones por capa**, y un **plan de refactor escalonado por PRs** para llegar a esa estructura sin perder estabilidad.

> Supuestos:
>
> - El proyecto ya usa **path aliases** (`@payments/*`, `@payments/domain/*`, etc.).
> - `index.ts` / barrel files están **prohibidos**.
> - Se mantienen y respetan los **boundary tests** existentes (UI ↔ Infra, Domain framework-free, i18n rules, etc.).

---

## Objetivos

1. **Navegabilidad por semántica**: abrir una carpeta y entender “qué pasa aquí” en <10 segundos.
2. **Entry points explícitos**: el entrypoint debe ser un archivo real (machine/service/facade/workflow), no un barrel.
3. **Escalabilidad sin “cajones”**: evitar carpetas que crecen sin control (`types/` gigante, `models/` gigante, etc.).
4. **Boundaries fuertes**: reforzar separación Domain / Application / Infrastructure / UI.
5. **Refactor seguro y gradual**: PRs chicos, verificables, con criterios claros de “listo”.

---

## Reglas de boundaries (tests existentes)

Estas reglas son **contratos** del refactor (no se rompen):

- **UI must not import Infrastructure**
- **Application must not import Infrastructure**
- **Domain must be framework-free** (no Angular/RxJS/HttpClient/i18n)
- **Infrastructure must not import UI**
- **i18n.t must be used only in UI layer**
- **messageKey must not be assigned from i18n.t()**
- **messageKey string literals must look like i18n keys**
- **specs outside UI must use I18nKeys for messageKey**

---

## Convenciones de nombres (nomenclatura por sufijo)

El folder comunica el **tema**, el nombre comunica el **valor**, y el sufijo comunica el **tipo de artefacto**:

- `*.types.ts` → `type` / `union` / `enum` (o const unions)
- `*.model.ts` → interfaces / estructuras de datos “con nombre”
- `*.event.ts` → ADTs / event maps (opcional)
- `*.command.ts` → inputs de operaciones (comandos)
- `*.vo.ts` → value objects (primitives)
- `*.rule.ts` → funciones puras que deciden/calculan/derivan
- `*.policy.ts` → gates booleanos simples / regla de negocio simple
- `*.port.ts` → interfaces de boundary (ports)

**Nota:** evitar sufijos genéricos como `*.contract.ts` en todo. El folder ya dice “contracts”; el sufijo debe agregar señal (model/types/command/event/etc.).

---

## Intención por capa

### `domain/`

**Propósito:** lenguaje del negocio + reglas puras + invariantes.  
**Prohibido:** Angular, RxJS, HttpClient, i18n.t, DI de Angular, etc.

Buckets internos del domain (por subdominio):

- `entities/` = modelos con significado (cuando hay invariantes / lifecycle / comportamiento)
- `rules/` = lógica pura (deriva/decide/calcula)
- `primitives/` = VOs e invariantes
- `contracts/` = lenguaje/shape del subdominio (models/types/events/commands “idioma”)
- `ports/` = interfaces hacia afuera (solo si son domain-intrinsic)

`domain/common/`:

- **ultra neutral**: primitives reutilizables (ids/money/time) y ports realmente universales (si aplica).
- evitar “common/models” salvo que sea absolutamente inevitable; preferir primitives/contratos estables.

### `application/`

**Propósito:** orquestación del sistema, casos de uso, puertos de aplicación, state machine, store, facades.  
**Puede usar:** RxJS, state mgmt, etc.  
**No puede importar:** infrastructure.

### `infrastructure/`

**Propósito:** implementación concreta de ports (adaptadores), mappers de provider → domain, DTOs, wiring interno por provider.  
**No puede importar:** UI.  
**Cada provider exporta su wiring** en `infrastructure/<provider>/di/provide-<provider>-payments.ts`.

### `config/`

**Composition root del feature**: compone el sistema importando _solo_ `provideXPayments()` por provider.

- Debe mantenerse **delgado**.
- No conoce internals del provider, solo lo “registra”.

### `ui/`

**Propósito:** presentación, i18n.t, pipes, pages, components.

- UI consume facades/ports de Application y tipos del Domain.
- UI **nunca** importa Infrastructure.

### `shared/` (feature-shared, NO UI)

Helpers reutilizables del feature que no son UI y no pertenecen al Domain (p.ej. utilidades de testing, factories auxiliares del feature, etc.).

---

## Estructura final objetivo (Project Tree)

> Nota: sin `index.ts` (barrels prohibidos).

```text
src/app/features/payments/
  payments.routes.ts

  config/
    payment.providers.ts
    payments-providers.types.ts
    payment.providers.spec.ts

  domain/
    common/
      primitives/
        ids/
        money/
        time/
      ports/
        clock.port.ts
        id-generator.port.ts
    subdomains/
      payment/
        contracts/
        entities/
        primitives/
        rules/
        policies/
        ports/
      fallback/
        contracts/
        entities/
        primitives/
        rules/
        ports/

  shared/
    idempotency/
    strategies/

  application/
    adapters/
      events/
      state/
    api/
      facades/
      ports/
      tokens/
        provider/
        flow/
        operations/
    orchestration/
      registry/
      flow/
        payment-flow/
          payment-flow.machine.ts
          payment-flow.facade.ts
          payment-flow.actor.service.ts
          context/
          policy/
          persistence/
          deps/
          stages/
      store/
        payment-store.ts
        payment-store.state.ts
        actions/
        types/
        projection/
        history/
        fallback/
      services/
      use-cases/

  infrastructure/
    fake/
      ...
    stripe/
      di/
        provide-stripe-payments.ts
      workflows/
        intent/
          stripe-intent.workflow.ts
          api/
          gateways/
          mappers/
          facades/
        polling/
          stripe-polling.workflow.ts
      methods/
        card/
          stripe-card.method.ts
          builders/
          validators/
          strategies/
        spei/
          stripe-spei.method.ts
          builders/
          mappers/
      errors/
        stripe-errors.module.ts
        mappers/
      testing/
        fixtures/
        fake-gateways/
      shared/
        idempotency/
        utils/
    paypal/
      di/
        provide-paypal-payments.ts
      workflows/
        order/
          paypal-order.workflow.ts
          api/
          gateways/
          mappers/
          facades/
        redirect/
          paypal-redirect.workflow.ts
          builders/
          handlers/
      methods/
        redirect/
          paypal-redirect.method.ts
      errors/
        mappers/
      testing/
        fixtures/
        fake-gateways/
      shared/
        utils/

  ui/
    pages/
    components/
    shared/
      pipes/
      types/
      utils/
    tests/
      ui-provider-coupling.spec.ts

  tests/
    payment-flow.contract.spec.ts
    payments-boundaries.spec.ts
```

---

## Detalles clave: `config/` + `infrastructure/<provider>/di/`

### `config/payment.providers.ts`

- Es el **punto de composición** del feature.
- Solo importa wiring expuesto por cada provider, por ejemplo:
  - `provideStripePayments()` desde `@payments/infrastructure/stripe/di/provide-stripe-payments`
  - `providePaypalPayments()` desde `@payments/infrastructure/paypal/di/provide-paypal-payments`

### `infrastructure/<provider>/di/provide-<provider>-payments.ts`

- **Único export** “oficial” hacia afuera del provider.
- Se encarga del wiring interno (tokens, factories, gateways, facades, policies provider-specific).

---

## Checklist de verificación por PR (Definition of Done)

Para cada PR, mínimo:

1. ✅ `bun run test:ci`
2. ✅ `bun run lint:fix`
3. ✅ tests de boundaries pasan (`payments-boundaries.spec.ts`, `ui-provider-coupling.spec.ts`, etc.)
4. ✅ no se introducen imports ilegales (Application → Infrastructure, UI → Infrastructure, Domain → framework)
5. ✅ no se agrega `index.ts`

Opcional recomendado:

- ✅ `bun run dep:check` (si ya lo usas)
- ✅ “grep” rápido de imports prohibidos (según tus reglas)

---

# Plan de Refactor Escalonado (PRs)

El refactor se plantea por **capas**, de menor a mayor riesgo, manteniendo el sistema funcionando siempre.

> Nota: “mover carpetas” cambia imports; como ya usas alias, localizar y corregir imports debería ser mecánico.

---

## PR 0 — Preparación y baseline (sin cambios funcionales)

**Objetivo:** asegurar un punto de partida estable y medible.

- Confirmar que todo pasa: `test:ci`, `lint:fix`, boundaries.
- Si aplica: agregar/actualizar un documento corto de reglas internas del feature (este mismo doc en el repo).

**Listo cuando:**

- Baseline verde y documentado.

---

## PR 1 — Application: `orchestration/flow` → estructura semántica `payment-flow/`

**Objetivo:** que `flow/` deje de verse “monstruo” y el entrypoint sea obvio.

- Mover todo lo de `application/orchestration/flow/*` a:
  - `application/orchestration/flow/payment-flow/` y subfolders:
    - `context/`, `policy/`, `persistence/`, `deps/`, `stages/`
- Mantener entrypoints en root:
  - `payment-flow.machine.ts`, `payment-flow.facade.ts`, `payment-flow.actor.service.ts`

**Listo cuando:**

- abrir `flow/` muestra solo `payment-flow/`.
- tests de flow + contract pasan.

---

## PR 2 — Application: `orchestration/store` → root limpio + subfolders

**Objetivo:** que `store/` sea entendible en 10s.

- Root:
  - `payment-store.ts`, `payment-store.state.ts`, specs
- Subfolders:
  - `actions/`, `types/`, `projection/`, `history/`, `fallback/`

**Listo cuando:**

- root del store es mínimo.
- imports actualizados sin tocar lógica.

---

## PR 3 — Application: `api/tokens` → agrupación por dominios (provider/flow/operations)

**Objetivo:** tokens adivinables, sin `index.ts`.

- Crear subfolders en `application/api/tokens/`:
  - `provider/`, `flow/`, `operations/`
- Mover tokens a su bucket.

**Listo cuando:**

- tokens no crecen como “carpeta plana”.

---

## PR 4 — Application: `adapters/` → semántica (events/state) y limpieza

**Objetivo:** adapters navegables y consistentes.

- `adapters/events/*` (incluye `external/` mappers si aplica)
- `adapters/state/*`
- Entry points explícitos por archivo (sin barrel).

**Listo cuando:**

- un dev entiende en dónde viven adapters de eventos vs estado.

---

## PR 5 — Infrastructure: Stripe → estructura final (workflows/methods/errors/testing/shared)

**Objetivo:** aplicar la estructura final a Stripe sin romper boundaries.

- Crear buckets:
  - `di/`, `workflows/intent/{api,gateways,mappers,facades}`, `methods/{card,spei}`, `errors/`, `testing/`, `shared/`
- Mover/renombrar gradualmente:
  - DTOs + constants → `workflows/intent/api/`
  - intent gateways → `workflows/intent/gateways/intent/`
  - mappers → `workflows/intent/mappers/` o `methods/spei/mappers/`
  - `get-idempotency-headers.ts` → `shared/idempotency/`
- Mantener `provide-stripe-payments.ts` como único export de wiring (aunque aún lo consuma config viejo temporalmente).

**Listo cuando:**

- no hay imports UI desde infra ni viceversa.
- provider wiring existe y compila.

---

## PR 6 — Infrastructure: PayPal → estructura final (workflows/methods/errors/testing/shared)

**Objetivo:** simetría estructural con Stripe, respetando que PayPal tiene workflows distintos.

- Crear buckets:
  - `di/`, `workflows/order`, `workflows/redirect`, `methods/redirect`, `errors/`, `testing/`, `shared/`
- Mover artifacts actuales a su lugar.

**Listo cuando:**

- PayPal se “lee” con la misma lógica que Stripe (aunque los workflows difieran).

---

## PR 7 — Config: provider wiring sale de `config/providers/*` → `infrastructure/<provider>/di/*`

**Objetivo:** `config/` delgadito y sin crecimiento innecesario.

- Eliminar (o dejar vacío temporalmente) `config/providers/*`
- `payment.providers.ts` compone:
  - `provideStripePayments()`
  - `providePaypalPayments()`
  - (y/o `provideFakePayments()` si aplica)

**Listo cuando:**

- `config/payment.providers.ts` no conoce internals del provider.
- ya no existe wiring duplicado en `config/providers/`.

---

## PR 8 — Domain: crear `domain/common` + `domain/subdomains/*` y mover (sin renames masivos)

**Objetivo:** mover archivos al nuevo layout **sin** hacer todavía un “rename tsunami”.

- Crear estructura:
  - `domain/common/primitives/{ids,money,time}`
  - `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,ports,policies}`
- Mover archivos actuales a buckets aproximados:
  - `payment-error.*` → `payment/contracts/errors/`
  - `payment-intent.*` → `payment/contracts/intent/`
  - `fallback-*` → `fallback/contracts/*`
  - `ports` → `payment/ports` o `common/ports` según ownership
- Mantener nombres originales temporalmente si hace falta (solo moves).

**Listo cuando:**

- compila y tests pasan.
- no se introdujo framework code en Domain.

---

## PR 9 — Domain: renombrado por convención (sufijos `.types.ts`, `.model.ts`, `.vo.ts`, etc.)

**Objetivo:** aplicar naming consistente ya con la estructura establecida.

- Renombrar archivos de Domain a los sufijos acordados.
- Actualizar imports.

**Listo cuando:**

- naming coherente y búsquedas rápidas funcionan (sufijo = tipo de artefacto).

---

## PR 10 — Ajustes cruzados + limpieza final

**Objetivo:** eliminar restos de estructura vieja y consolidar.

- Borrar directorios vacíos / archivos obsoletos.
- Ajustar cualquier test que referencie paths antiguos.
- Validar boundaries de nuevo, dep check si aplica.

**Listo cuando:**

- no queda “duplicación” (viejo + nuevo).
- el repo se siente consistente y navegable.

---

## Notas operativas (para reducir dolor)

- **Mueve primero, renombra después**: reduce el tamaño del diff y mejora la trazabilidad.
- Aprovecha que ya usas aliases:
  - es fácil “grep” de rutas antiguas y corregir imports.
- Mantén PRs con cambios mecánicos:
  - un PR = un área (flow / store / stripe / paypal / config / domain move / domain rename).
- Evita mezclar “refactor estructural” con “cambio funcional”.

---

## Apéndice: recomendaciones de ownership (para evitar duplicación)

- `PaymentGatewayPort` y similares (orquestación del sistema) → **Application/api/ports/**
- `ClockPort`, `IdGeneratorPort` (si son intrínsecos al dominio) → **Domain/common/ports/**
- `WebhookVerifierPort`:
  - si es parte de invariantes del dominio (validación conceptual) → Domain
  - si es 100% integración técnica → Application/Infrastructure según diseño

---

**Fin del documento.**
