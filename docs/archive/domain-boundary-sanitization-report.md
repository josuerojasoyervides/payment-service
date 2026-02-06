# Reporte: Domain Boundary Sanitization — Payments Feature

**Fecha de ejecución:** Febrero 2025  
**Alcance:** Feature `payments` — capa Domain  
**Objetivo:** Eliminar boundary leaks para lograr un Domain framework-agnostic, UI-agnostic e infra-agnostic.

**Ramas de referencia:**

- Base: `refactor/domain-sanitize` (estado antes de los cambios)
- Resultado: `refactor/domain-by-agent` (estado después)

---

## 1. Contexto y motivación

El Domain del feature `payments` contenía elementos que violaban principios de Clean Architecture:

- Contratos de UI/forms (schema de formularios, i18n keys)
- Implementaciones base con lógica de validación y `throw`
- Reglas de negocio dispersas en capas Application/Shared

Se ejecutó un plan de sanitización por severidad (P0 → P1 → P2) con checks verificables.

---

## 2. Mapa de capas (referencia)

| Capa             | Path                                        | Rol                                              |
| ---------------- | ------------------------------------------- | ------------------------------------------------ |
| Domain           | `src/app/features/payments/domain/`         | Tipos, modelos, reglas puras, ports (interfaces) |
| Application      | `src/app/features/payments/application/`    | Use cases, orchestration, adapters, facades      |
| Infrastructure   | `src/app/features/payments/infrastructure/` | Stripe, PayPal, gateways concretos               |
| UI               | `src/app/features/payments/ui/`             | Pages, components, forms                         |
| Shared (feature) | `src/app/features/payments/shared/`         | Strategies (card, spei), idempotency             |

---

## 3. Paso 0 — Baseline (no cambios de código)

### Intención

Capturar evidencia del estado inicial para comparar antes/después.

### Proceso

Ejecución de comandos de verificación:

- `grep @angular|rxjs|inject(` en `domain/` → **0 resultados** (Domain ya limpio)
- `grep I18nKeys|labelKey|placeholderKey|autoComplete|FieldType` en `domain/` → **6 coincidencias** en 2 archivos
- `grep "throw new Error("` en `domain/` → **2 coincidencias** en 1 archivo

### Resultados

| Check                        | Estado inicial         |
| ---------------------------- | ---------------------- |
| Angular/RxJS en Domain       | ✅ Limpio              |
| Schema i18n/form en Domain   | ⚠️ 6 violaciones       |
| `throw new Error(` en Domain | ⚠️ 2 violaciones       |
| `bun run test`               | 72 files, 689 tests OK |

---

## 4. Paso 1 — P0: FieldRequirements fuera de Domain

### Intención

Sacar el schema de formularios (FieldType, FieldRequirement, AutoCompleteHint) del Domain. Son detalles de UI, no de negocio.

### Archivos creados

| Archivo                                                          | Descripción                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `application/api/contracts/checkout-field-requirements.types.ts` | Contrato central: `FieldType`, `FieldRequirement`, `FieldRequirements`, `AutoCompleteHint` |

### Archivos eliminados

| Archivo                                               | Razón                                             |
| ----------------------------------------------------- | ------------------------------------------------- |
| `domain/common/entities/field.types.ts`               | Tipos de input HTML en Domain                     |
| `domain/common/entities/field-requirement.model.ts`   | Schema form + i18n keys en Domain                 |
| `domain/common/primitives/autocomplete-hint.types.ts` | Valores de atributo HTML `autocomplete` en Domain |

### Archivos modificados (imports actualizados)

- `ui/shared/ui.types.ts`
- `ui/components/payment-form/payment-form.component.ts`
- `ui/components/payment-form/payment-form.component.spec.ts`
- `ui/forms/payment-options/payment-options-form.ts`
- `ui/forms/payment-options/rules/payment-options-form.rules.ts`
- `ui/forms/payment-options/types/payment-options-form.types.ts`
- `ui/pages/checkout/checkout.page.ts`
- `ui/pages/checkout/checkout.page.spec.ts`
- `application/adapters/state/ngrx-signals-state.adapter.ts`
- `application/api/ports/payment-store.port.ts`
- `application/api/ports/provider-factory.port.ts`
- `application/api/testing/provide-mock-payment-state.harness.ts`
- `infrastructure/stripe/core/factories/stripe-provider.factory.ts`
- `infrastructure/paypal/core/factories/paypal-provider.factory.ts`

### Expectativas

- Domain sin referencias a `FieldRequirement`, `labelKey`, `placeholderKey`
- Tests pasando

### Resultados

| Check                                                     | Resultado              |
| --------------------------------------------------------- | ---------------------- |
| `grep FieldRequirement\|labelKey\|placeholderKey domain/` | 0 resultados           |
| `bun run test`                                            | ✅ 72 files, 689 tests |

---

## 5. Paso 2 — P0: AbstractTokenValidator fuera de Domain

### Intención

Eliminar `throw new Error()` con strings mágicos en Domain. La base abstracta con validación debe vivir en Infra/Application.

### Archivos creados

| Archivo                                                                | Descripción                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `infrastructure/stripe/shared/policies/base-token-validator.ts`        | Clase base que usa `invalidRequestError(I18nKeys...)` en lugar de `throw new Error()` |
| i18n: `card_token_invalid_format` en `i18n.types.ts`, `en.ts`, `es.ts` | Nueva key para errores de formato de token                                            |

### Archivos modificados

| Archivo                                                                       | Cambio                                                                        |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `infrastructure/stripe/shared/policies/stripe-token-validator.policy.ts`      | Extiende `BaseTokenValidator` en lugar de `AbstractTokenValidator`            |
| `infrastructure/stripe/shared/policies/stripe-token-validator.policy.spec.ts` | Aserciones actualizadas: esperan `PaymentError` con `expect.objectContaining` |

### Archivos eliminados

| Archivo                                                        | Razón                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `domain/.../ports/token-validator/abstract-token-validator.ts` | Contenía throws con strings mágicos y `maskToken` con `'[invalid]'` |

### Decisiones de diseño

- El **port** `TokenValidator` permanece en Domain (solo interfaz).
- La **implementación base** vive en Infra (Stripe) porque usa `invalidRequestError` e I18nKeys.
- `maskToken` devuelve `'***'` en lugar de `'[invalid]'`.

### Expectativas

- Domain sin `throw new Error("...")`
- Validación con errores tipados (`PaymentError`)

### Resultados

| Check                             | Resultado              |
| --------------------------------- | ---------------------- |
| `grep "throw new Error(" domain/` | 0 resultados           |
| `bun run test`                    | ✅ 72 files, 689 tests |

---

## 6. Paso 3 — P1: AbstractPaymentRequestBuilder fuera de Domain

### Intención

Un port debe ser una interfaz. La clase base con lógica de validación y helpers no pertenece al Domain.

### Archivos creados

| Archivo                                                    | Descripción                                                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `application/api/builders/base-payment-request.builder.ts` | Clase abstracta `BasePaymentRequestBuilder` con helpers (`requireDefined`, `requireNonEmptyString`, etc.) que usan `invalidRequestError` |

### Archivos modificados

| Archivo                                                                              | Cambio                                                                                               |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `application/api/ports/provider-factory.port.ts`                                     | `createRequestBuilder` retorna `PaymentRequestBuilderPort` en lugar de tipo concreto                 |
| `infrastructure/stripe/core/factories/stripe-provider.factory.ts`                    | Tipo de retorno explícito `PaymentRequestBuilderPort`; eliminado import de builder abstracto         |
| `infrastructure/paypal/core/factories/paypal-provider.factory.ts`                    | Igual que Stripe                                                                                     |
| `infrastructure/stripe/payment-methods/card/builders/stripe-card-request.builder.ts` | Extiende `BasePaymentRequestBuilder`                                                                 |
| `infrastructure/stripe/payment-methods/spei/builders/stripe-spei-request.builder.ts` | Igual                                                                                                |
| `infrastructure/stripe/core/builders/stripe-create-request.builder.ts`               | Extiende `BasePaymentRequestBuilder`; `PaymentOptions` importado desde `payment-options.model` (fix) |
| `infrastructure/paypal/core/builders/paypal-redirect-request.builder.ts`             | Extiende `BasePaymentRequestBuilder`                                                                 |

### Archivos eliminados

| Archivo                                                                | Razón                      |
| ---------------------------------------------------------------------- | -------------------------- |
| `domain/.../ports/payment-request/abstract-payment-request-builder.ts` | Port ≠ implementación base |

### Expectativas

- `domain/.../ports/` solo contiene interfaces
- `bun run test` y `dep:check` en verde

### Resultados

| Check               | Resultado                                         |
| ------------------- | ------------------------------------------------- |
| Estructura de ports | Solo `payment-request-builder.port.ts` (interfaz) |
| `bun run test`      | ✅ 72 files, 689 tests                            |
| `bun run dep:check` | ✅ Sin violaciones                                |

---

## 7. Paso 4 — P1: Reglas SPEI y Card Amount en Domain

### Intención

Mover reglas de negocio dispersas en strategies al Domain como reglas puras (sin i18n, sin RxJS).

### Archivos creados

| Archivo                                                               | Descripción                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `domain/subdomains/payment/rules/spei-amount.rule.ts`                 | `SPEI_MIN_AMOUNT_MXN`, `SPEI_MAX_AMOUNT_MXN`, `validateSpeiAmount()`, `getSpeiLimitsMxn()` |
| `domain/subdomains/payment/rules/spei-amount.rule.spec.ts`            | Tests unitarios puros (sin Angular/RxJS)                                                   |
| `domain/subdomains/payment/rules/min-amount-by-currency.rule.ts`      | `getCardMinAmount(currency)`, `validateCardAmount()`                                       |
| `domain/subdomains/payment/rules/min-amount-by-currency.rule.spec.ts` | Tests unitarios puros                                                                      |

### Archivos modificados

| Archivo                              | Cambio                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `shared/strategies/spei-strategy.ts` | Usa `validateSpeiAmount()`; traduce violaciones a `PaymentError` con `invalidRequestError(I18nKeys...)` |
| `shared/strategies/card-strategy.ts` | Usa `validateCardAmount()` y `getCardMinAmount()`; mismo patrón de traducción                           |

### Modelo de violaciones (Domain)

- `SpeiAmountViolation`: `{ code: 'SPEI_INVALID_CURRENCY' | 'SPEI_AMOUNT_TOO_LOW' | 'SPEI_AMOUNT_TOO_HIGH'; meta? }`
- `CardAmountViolation`: `{ code: 'CARD_AMOUNT_TOO_LOW'; meta? }`

Las strategies traducen violaciones a `PaymentError` en Shared/Application (capa que conoce I18nKeys).

### Expectativas

- Reglas puras en Domain con tests sin framework
- Strategies usan reglas; i18n permanece fuera de Domain

### Resultados

| Check                  | Resultado              |
| ---------------------- | ---------------------- |
| Reglas puras con tests | ✅                     |
| `bun run test`         | ✅ 72 files, 689 tests |
| `bun run dep:check`    | ✅ Sin violaciones     |

---

## 8. Paso 5 — P2 (opcional): isEligibleForFallbackPolicy en Domain

### Intención

Mejorar cohesión del subdominio fallback: la decisión "¿este error dispara fallback?" es una política de negocio pura.

### Archivos creados

| Archivo                                                               | Descripción                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `domain/subdomains/fallback/policies/eligible-for-fallback.policy.ts` | Función pura `isEligibleForFallbackPolicy(config, error): boolean` |

### Archivos modificados

| Archivo                                                    | Cambio                                             |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `application/.../policies/fallback-orchestrator.policy.ts` | Eliminada implementación; reexporta desde Domain   |
| `application/.../fallback-orchestrator.service.ts`         | Importa `isEligibleForFallbackPolicy` desde Domain |

### Expectativas

- Función pura en Domain
- Tests y depcruise sin regresiones

### Resultados

| Check               | Resultado          |
| ------------------- | ------------------ |
| `bun run test`      | ✅                 |
| `bun run dep:check` | ✅ Sin violaciones |

---

## 9. Resumen de cambios por tipo

### Nuevos archivos (10)

- `application/api/contracts/checkout-field-requirements.types.ts`
- `application/api/builders/base-payment-request.builder.ts`
- `infrastructure/stripe/shared/policies/base-token-validator.ts`
- `domain/subdomains/payment/rules/spei-amount.rule.ts`
- `domain/subdomains/payment/rules/spei-amount.rule.spec.ts`
- `domain/subdomains/payment/rules/min-amount-by-currency.rule.ts`
- `domain/subdomains/payment/rules/min-amount-by-currency.rule.spec.ts`
- `domain/subdomains/fallback/policies/eligible-for-fallback.policy.ts`

### Archivos eliminados (4)

- `domain/common/entities/field.types.ts`
- `domain/common/entities/field-requirement.model.ts`
- `domain/common/primitives/autocomplete-hint.types.ts`
- `domain/.../ports/token-validator/abstract-token-validator.ts`
- `domain/.../ports/payment-request/abstract-payment-request-builder.ts`

### Archivos modificados (~25)

UI, Application, Infrastructure — principalmente actualización de imports y referencias.

---

## 10. Contrato de pureza de Domain (post-refactor)

### Domain PUEDE contener

- Tipos/modelos de negocio, invariantes
- Reglas puras (`*.rule.ts`), policies puras (`*.policy.ts`)
- Value objects (`*.vo.ts`), funciones puras
- Errores del dominio sin texto de UI (códigos/metadata)

### Domain NO debe contener

- Angular, RxJS, Signals, DI tokens
- UI schema: i18n keys, labels/placeholders, tipos de input HTML, autocomplete hints
- Infra specifics: SDKs de proveedores, DTOs externos
- `throw new Error("texto libre")`
- Clases abstractas con implementación que lance errores

---

## 11. Verificación final

| Verificación                 | Antes         | Después |
| ---------------------------- | ------------- | ------- |
| Schema i18n en Domain        | 6 violaciones | 0       |
| `throw new Error(` en Domain | 2 violaciones | 0       |
| Tests                        | 689 OK        | 689 OK  |
| dep:check                    | OK            | OK      |
| Módulos analizados           | —             | 289     |
| Dependencias analizadas      | —             | 747     |

---

## 12. Recomendaciones futuras

1. **Guardrails:** Añadir en `payments-boundaries.spec.ts` un test que falle si existe `throw new Error(` en archivos bajo `domain/`.
2. **Dependency-cruiser:** Regla explícita que prohíba en Domain imports de `field.types`, `field-requirement`, `autocomplete-hint` (ya movidos).
3. **NoopTokenValidator:** Evaluar si debe permanecer en Domain (no lanza, es default implementation) o moverse a Application/Shared por consistencia.

---

## Anexo A: Historial de cambios (diff entre ramas)

Comando usado:

```bash
git diff refactor/domain-sanitize..refactor/domain-by-agent --stat
git diff refactor/domain-sanitize..refactor/domain-by-agent --name-status
git log refactor/domain-sanitize..refactor/domain-by-agent --oneline
```

### Historial de commits (orden cronológico)

| Commit    | Descripción                                                                              |
| --------- | ---------------------------------------------------------------------------------------- |
| `3430c8a` | Refactor(field-requirements): migrate field requirements to new contracts structure      |
| `2458062` | Enhance(token-validation): add card token invalid format error handling                  |
| `58b3218` | feat(payment-request): implement BasePaymentRequestBuilder and refactor request builders |
| `73e63e0` | feat(payment-rules): add minimum amount validation for card and SPEI payments            |
| `5300f15` | feat(fallback-policy): introduce eligibility policy for fallback triggers                |

### Resumen numérico del diff

| Métrica            | Valor |
| ------------------ | ----- |
| Archivos afectados | 39    |
| Líneas añadidas    | +609  |
| Líneas eliminadas  | -159  |
| Balance neto       | +450  |

### Clasificación de archivos por tipo de cambio

**Añadidos (A):** 7 archivos  
**Eliminados (D):** 3 archivos  
**Renombrados (R):** 2 archivos (91% y 55% de similitud)  
**Modificados (M):** 27 archivos

#### Añadidos (A)

| Archivo                                                               |
| --------------------------------------------------------------------- |
| `.cursor/plans/domain_boundary_sanitization_a9ee97cf.plan.md`         |
| `application/api/contracts/checkout-field-requirements.types.ts`      |
| `domain/subdomains/fallback/policies/eligible-for-fallback.policy.ts` |
| `domain/subdomains/payment/rules/min-amount-by-currency.rule.ts`      |
| `domain/subdomains/payment/rules/min-amount-by-currency.rule.spec.ts` |
| `domain/subdomains/payment/rules/spei-amount.rule.ts`                 |
| `domain/subdomains/payment/rules/spei-amount.rule.spec.ts`            |

#### Eliminados (D)

| Archivo                                               |
| ----------------------------------------------------- |
| `domain/common/entities/field-requirement.model.ts`   |
| `domain/common/entities/field.types.ts`               |
| `domain/common/primitives/autocomplete-hint.types.ts` |

#### Renombrados / Movidos (R)

| Origen                                           | Destino                                                         | Similitud |
| ------------------------------------------------ | --------------------------------------------------------------- | --------- |
| `domain/.../abstract-payment-request-builder.ts` | `application/api/builders/base-payment-request.builder.ts`      | 91%       |
| `domain/.../abstract-token-validator.ts`         | `infrastructure/stripe/shared/policies/base-token-validator.ts` | 55%       |

#### Modificados (M)

27 archivos (i18n, adapters, ports, factories, builders, strategies, UI components).

---

_Documento generado como parte del plan Domain Boundary Sanitization. Referencia: `.cursor/plans/domain_boundary_sanitization_a9ee97cf.plan.md`_
