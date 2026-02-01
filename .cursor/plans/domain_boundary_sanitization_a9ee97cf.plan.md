---
name: Domain Boundary Sanitization
overview: 'Análisis de boundary leaks en la capa Domain del feature payments: elementos que deben salir de Domain (UI/form/infra en domain, throws con strings mágicos), lógica de negocio que debe entrar (reglas SPEI/card amount), y plan de refactor ordenado por severidad P0 → P1 → P2 con checks verificables.'
todos: []
isProject: false
---

# Plan: Sanitización de límites de la capa Domain (payments)

## Mapa de capas (verificado en repo)

| Capa                 | Path                                        | Patrones                                                                                                                                                                           |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain**           | `src/app/features/payments/domain/`         | `*.types.ts`, `*.model.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`; subcarpetas `common/`, `subdomains/payment/`, `subdomains/fallback/` |
| **Application**      | `src/app/features/payments/application/`    | Ports, use cases, orchestration, adapters, tokens, facades                                                                                                                         |
| **Infrastructure**   | `src/app/features/payments/infrastructure/` | Stripe, PayPal, fake; gateways, DTOs, builders concretos                                                                                                                           |
| **UI**               | `src/app/features/payments/ui/`             | Pages, components, forms, config                                                                                                                                                   |
| **Shared (feature)** | `src/app/features/payments/shared/`         | Strategies (card, spei), idempotency; **no** UI                                                                                                                                    |
| **Config**           | `src/app/features/payments/config/`         | DI composition, providers                                                                                                                                                          |

**Reglas implícitas:** Domain no importa `@angular`, `rxjs`, `inject(`, `i18n.t(` (guardado en [payments-boundaries.spec.ts](src/app/features/payments/tests/payments-boundaries.spec.ts)). Dependency-cruiser: `domain-no-external-deps`, `domain-no-angular`, `domain-no-rxjs`, `domain-no-app-core-or-shared`, `domain-no-shared` ([.dependency-cruiser.js](.dependency-cruiser.js)).

---

## A) Está en Domain pero debe SALIR de Domain

### A1. [abstract-token-validator.ts](src/app/features/payments/domain/subdomains/payment/ports/token-validator/abstract-token-validator.ts) — **P0**

- **Problema:** `throw new Error(\`Token is required for this payment method)`y`throw new Error(Invalid token format...)`; TODOs en código: "Fix this magic strings", "Fix - i18n usage here".` maskToken`devuelve`'[invalid]'` (string mágico).
- **Por qué viola Domain:** Regla "Throws con strings mágicos: preferir modelos de error del dominio o resultados tipados". Domain no debe contener mensajes de error para usuario ni lógica que lance con texto libre.
- **A dónde mover:** **Application** (o Infra). El **port** (`TokenValidator` interface) se queda en Domain; la **clase base abstracta** con `validate()` que lanza debe moverse.
- **Propuesta:**
  - Mantener en Domain: [token-validator.port.ts](src/app/features/payments/domain/subdomains/payment/ports/token-validator/token-validator.port.ts) (solo interfaz).
  - Mover `AbstractTokenValidator` a `application/.../validation/` o a cada infra (Stripe/PayPal) como base privada.
  - Cambiar contrato: que `validate(token)` devuelva `void` pero que las implementaciones en Infra usen `invalidRequestError(...)` y lancen `PaymentError`, o que el port devuelva `Result<void, PaymentError>` y quien llama decida lanzar.
  - Sufijo recomendado en Application: `*.base.ts` o vivir solo en Infra como clase base de los validators concretos.

### A2. [autocomplete-hint.types.ts](src/app/features/payments/domain/common/primitives/autocomplete-hint.types.ts) — **P0**

- **Problema:** Valores son los del atributo HTML `autocomplete` (`cc-number`, `cc-exp`, `street-address`, etc.).
- **Por qué viola Domain:** Regla "Domain NO debe contener: Detalles de UI: … HTML autocomplete".
- **A dónde mover:** **UI** (form metadata) o **Application** si el catálogo de checkout expone "qué autocomplete usar por campo".
- **Propuesta:** Crear `ui/forms/payment-options/autocomplete-hint.types.ts` (o bajo `application/api/ports/` si el port de catálogo devuelve algo que incluye hint). Actualizar [field-requirement.model.ts](src/app/features/payments/domain/common/entities/field-requirement.model.ts) para que no dependa de este tipo: o se mueve todo el contrato de "requisitos de campo" fuera de Domain (ver A3), o se usa `string` para `autoComplete` en el contrato que quede en Application.

### A3. [field.types.ts](src/app/features/payments/domain/common/entities/field.types.ts) y [field-requirement.model.ts](src/app/features/payments/domain/common/entities/field-requirement.model.ts) — **P0**

- **Problema:** `FieldType` = `'text' | 'email' | 'hidden' | 'url'` (tipo de input de formulario). `FieldRequirement` tiene `labelKey`, `placeholderKey`, `descriptionKey`, `instructionsKey`, `type`, `autoComplete` — son datos para renderizar formulario e i18n.
- **Por qué viola Domain:** Regla "Domain NO debe contener: i18n keys, labels, placeholders, … form schema".
- **A dónde mover:** **Application** (contrato del catálogo de checkout: "qué campos requiere un método"). El port [provider-factory.port.ts](src/app/features/payments/application/api/ports/provider-factory.port.ts) ya define `getFieldRequirements(type): FieldRequirements`; el **tipo** `FieldRequirements` / `FieldRequirement` debe vivir en Application, no en Domain.
- **Propuesta:**
  - Nuevo módulo en Application, p.ej. `application/api/contracts/` o `application/api/ports/checkout-catalog.types.ts`: definir `FieldType`, `FieldRequirement`, `FieldRequirements` (con `labelKey`, `placeholderKey`, etc.) y opcionalmente `AutoCompleteHint` si se centraliza aquí en vez de en UI.
  - Eliminar de Domain: `domain/common/entities/field.types.ts`, `domain/common/entities/field-requirement.model.ts`, `domain/common/primitives/autocomplete-hint.types.ts`.
  - Actualizar todos los consumidores (UI, Application, Infrastructure) para importar desde el nuevo path.
  - En Domain no debe quedar referencia a "form schema"; solo entidades de negocio (p.ej. `PaymentOptions` con `keyof PaymentOptions` para nombres de campo si hace falta en algún tipo de Application).

### A4. [abstract-payment-request-builder.ts](src/app/features/payments/domain/subdomains/payment/ports/payment-request/abstract-payment-request-builder.ts) — **P1**

- **Problema:** Está bajo `domain/.../ports/` pero es una **clase abstracta con implementación** (helpers `requireDefined`, `requireNonEmptyString`, `requirePositiveAmount`, `validateOptionalUrl`, etc. que llaman a `invalidRequestError(...)` y hacen `throw`). En Clean Architecture, un "port" es una interfaz/contrato, no una base con lógica.
- **Por qué viola Domain:** La **lógica de validación** (qué es requerido, formato URL, cantidad positiva) es orquestación/uso del dominio; el dominio debe exponer tipos y reglas puras, no la base de implementación de un builder usado por Infra.
- **A dónde mover:** **Application** o **Shared (feature)**. La interfaz [payment-request-builder.port.ts](src/app/features/payments/domain/subdomains/payment/ports/payment-request/payment-request-builder.port.ts) se queda en Domain; la clase base que implementa esa interfaz y centraliza validación debe vivir fuera.
- **Propuesta:**
  - Crear `application/.../builders/` o `shared/builders/`: p.ej. `base-payment-request.builder.ts` con la clase abstracta actual (importando `invalidRequestError` y tipos desde Domain).
  - Los builders concretos en Infra (Stripe, PayPal) extienden esa clase desde Application/Shared.
  - Domain conserva solo: `PaymentRequestBuilderPort`, `CreatePaymentRequest`, `PaymentOptions`, factory `invalidRequestError`/`createPaymentError`.
  - Sufijo: `*.builder.ts` (base) en Application o Shared.

---

## B) Está FUERA de Domain pero debe ENTRAR a Domain

### B1. Límites de monto SPEI (en [spei-strategy.ts](src/app/features/payments/shared/strategies/spei-strategy.ts)) — **P1**

- **Lógica detectada:** `MIN_AMOUNT_MXN = 1`, `MAX_AMOUNT_MXN = 8_000_000`, "solo MXN"; validación en `validate(req)` con `invalidRequestError(I18nKeys...)`.
- **Por qué es dominio:** Son invariantes/regulación del método SPEI (límites y moneda permitida), no decisión de orquestación ni de UI.
- **Cómo modelar en Domain:** Value object o regla pura en `domain/subdomains/payment/`: p.ej. `primitives/spei-amount.vo.ts` o `rules/spei-amount.rule.ts` con constantes y función pura `isValidSpeiAmount(amount, currency): boolean` o `assertSpeiAmount(amount, currency): void` que no lance con strings mágicos sino que devuelva resultado tipado o use códigos de error del dominio. La strategy en Shared/Infra llamaría a esa regla y traduciría a `PaymentError` con `invalidRequestError(messageKey, params)` (messageKey sigue siendo responsabilidad de la capa que lanza; Domain solo expone la regla "¿es válido?").
- **Impacto:** Testabilidad de límites SPEI sin RxJS ni gateways; cambio de regulación en un solo lugar; Domain sin I18nKeys.

### B2. Mínimo de monto por moneda (en [card-strategy.ts](src/app/features/payments/shared/strategies/card-strategy.ts)) — **P1**

- **Lógica detectada:** `minAmount = req.currency === 'MXN' ? 10 : 1` y validación con `invalidRequestError(I18nKeys.min_amount, ...)`.
- **Por qué es dominio:** Regla de negocio "mínimo por moneda" para pagos con tarjeta (u otro método), no detalle de estrategia ni UI.
- **Cómo modelar en Domain:** Regla pura en `domain/subdomains/payment/rules/` o `policies/`: p.ej. `min-amount-by-currency.rule.ts` con `getMinAmountForCurrency(currency: CurrencyCode): number` o `isValidAmountForCard(amount, currency): boolean`. Sin throws ni I18nKeys; la strategy usa la regla y construye el error en Application/Shared.
- **Impacto:** Misma moneda/regla reutilizable por otros métodos; tests de dominio puros.

### B3. Política "¿error elegible para fallback?" (en [fallback-orchestrator.policy.ts](src/app/features/payments/application/orchestration/services/fallback/policies/fallback-orchestrator.policy.ts)) — **P2**

- **Lógica detectada:** `isEligibleForFallbackPolicy(config: FallbackConfig, error: PaymentError): boolean` — función pura que solo usa `config.triggerErrorCodes.includes(error.code)`.
- **Por qué puede ser dominio:** La decisión "este error es uno que dispara fallback" es una política de negocio del subdominio fallback (basada en código de error y configuración).
- **Cómo modelar en Domain:** Opcional: mover a `domain/subdomains/fallback/policies/eligible-for-fallback.policy.ts` como función pura que recibe `TriggerErrorCodes` + `PaymentError` (o solo `PaymentErrorCode`). FallbackConfig ya está en Domain; esta policy es un one-liner y puede quedarse en Application sin problema; moverla es mejora de cohesión, no P0/P1.
- **Impacto:** Subdominio fallback más autocontenido; tests de política sin inyectar servicios.

---

## C) Acciones recomendadas (plan en pasos, P0 → P1 → P2)

### Fase P0 — Rompe separación / imposible cambiar UI o proveedor sin tocar Domain

1. **Mover FieldRequirement / FieldType / AutoCompleteHint fuera de Domain**

- Crear tipos en Application (p.ej. `application/api/contracts/checkout-field.types.ts` o junto al port de catálogo).
- Actualizar imports en UI, Application, Infrastructure.
- Eliminar `domain/common/entities/field.types.ts`, `domain/common/entities/field-requirement.model.ts`, `domain/common/primitives/autocomplete-hint.types.ts`.
- **Check:** `grep -r "from.*domain.*field.types\|field-requirement.model\|autocomplete-hint" src/app/features/payments` no debe apuntar a `domain/`; `bun run test`; depcruise sin nuevas violaciones.

1. **Eliminar throws con strings mágicos en AbstractTokenValidator (Domain)**

- Opción A: Mover `AbstractTokenValidator` a Application o Infra; en Domain dejar solo la interfaz `TokenValidator`.
- Opción B: Cambiar `validate(token)` para que no lance; que devuelva `PaymentError | null` o que las subclases (en Infra) implementen validación y lancen `invalidRequestError(...)`.
- **Check:** Ningún archivo bajo `domain/` debe contener `throw new Error(\`...)`con mensaje libre;`bun run test`; boundaries spec en verde.

### Fase P1 — Erosiona diseño (reglas fuera de Domain, acoplamientos)

1. **Mover AbstractPaymentRequestBuilder fuera de Domain**

- Crear clase base en Application o Shared; Infra la extiende.
- Domain solo: `PaymentRequestBuilderPort`, `CreatePaymentRequest`, factory de errores, tipos.
- **Check:** `grep -r "abstract-payment-request-builder" src/app/features/payments` solo desde application/ o shared/ o infrastructure/; depcruise ok.

1. **Introducir reglas de monto en Domain (SPEI y card)**

- Añadir `domain/subdomains/payment/rules/spei-amount.rule.ts` (o `.vo.ts`) con constantes y función pura de validez.
- Añadir `domain/subdomains/payment/rules/min-amount-by-currency.rule.ts` (o policy).
- Refactorizar `SpeiStrategy` y `CardStrategy` para usar esas reglas y seguir construyendo `PaymentError` en la capa actual (sin I18nKeys en Domain).
- **Check:** Tests unitarios de las reglas puras sin Angular/RxJS; strategies siguen pasando tests; `bun run test`.

### Fase P2 — Deuda menor (naming, cohesión)

1. **Opcional: Mover isEligibleForFallbackPolicy a Domain**

- Crear `domain/subdomains/fallback/policies/eligible-for-fallback.policy.ts` con la función pura.
- FallbackOrchestratorService importa desde Domain.
- **Check:** `bun run test`; depcruise ok.

1. **Guardrails adicionales**

- Añadir en `payments-boundaries.spec.ts` un test que falle si existe `throw new Error(` en archivos bajo `domain/` (excepto si se documenta excepción).
- Opcional: regla depcruise o test que prohíba en Domain imports de `field.types`, `field-requirement`, `autocomplete-hint` una vez movidos.

### Checks transversales por paso

- **Después de cada paso:** `bun run test` (incl. `payments-boundaries.spec.ts`).
- **Al final:** `bun run test`; si existe script depcruise (p.ej. en `package.json`), ejecutarlo y verificar que no haya nuevas violaciones de `domain-no-*` o `application-no-infra` / `ui-no-infra`.

---

## Resumen de severidad

| Ítem                                                      | Severidad | Motivo                                                               |
| --------------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| FieldRequirement / FieldType / AutoCompleteHint en Domain | P0        | Form schema e i18n keys en Domain; rompe "Domain sin UI".            |
| AbstractTokenValidator con throw new Error en Domain      | P0        | Strings mágicos y mensajes de usuario en Domain.                     |
| AbstractPaymentRequestBuilder en domain/ports             | P1        | Port = interfaz; implementación base no debe estar en Domain.        |
| Límites SPEI y min amount card en strategies              | P1        | Reglas de negocio fuera de Domain; deberían ser reglas/vo en Domain. |
| isEligibleForFallbackPolicy en Application                | P2        | Función pura; opcional mover a Domain para cohesión.                 |

No se han inventado archivos; todas las rutas y hallazgos referencian archivos existentes en el repo. Si algún path de "propuesta" no existe aún, debe crearse en el refactor.
