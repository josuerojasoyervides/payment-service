# Payments Module — Architecture & Quality Rules

> **Last review:** 2026-02-01
> This repo is a lab to practice payments architecture **without turning it into a spider web**.

## How to read this document

This doc has two roles:

1. **North Star (guide)** — how the module should look when it is stable.
2. **Snapshot (history)** — what is applied today, what is partial, and what is accepted debt.

You will see sections with:

- **Rule (target)**
- **Current state (as of 2026-01-26)**
- **Accepted deviation** (if any) + **closure plan**

---

## Language policy

**Official language:** English.

- All code, comments, tests, docs, and logs must be written in English.
- The only exception is i18n translation files (they can contain localized copy).

---

## 0) Module layers (target)

> **Goal:** minimal coupling + incremental evolution.

**Layers (feature `payments/`):**

- `domain/` → models, types, factories, pure TS rules.
- `application/` → use cases, ports, orchestration services (no UI).
- `infrastructure/` → provider integrations (Stripe/PayPal), mapping, DTOs.
- `shared/` → shared feature utilities **that are NOT UI** (helpers, neutral mappers).
- `ui/` → pages, components, renderers, view adapters.
- `config/` → feature DI composition (providers, tokens, wiring).

**Rule:** a layer may depend only on inner layers (or strictly controlled lateral dependencies).

**Current state:** structure exists and is respected.

---

## 1) Non-negotiable boundaries

### 1.1 Domain is pure TS

**Rule (target)**

- `domain/` **must not** import Angular, RxJS, HttpClient, `i18n.t`.
- Only types, factories, validators, and **pure** data normalization.

**Current state:** satisfied.

---

### 1.2 UI never orchestrates business logic

**Rule (target)**

- UI only:
  - triggers actions/use cases,
  - renders state,
  - shows translated errors,
  - handles navigation.

**Current state:** satisfied (flow facade + XState carry the weight; UI does not touch store directly).

---

### 1.3 Application does not depend on Infrastructure

**Rule (target)**

- `application/` defines contracts (ports) and orchestration.
- `infrastructure/` implements them.

**Current state:** satisfied at import level.

---

## 2) Allowed dependencies (quick map)

**Rule (target)**

- `ui/` → can import `application/`, `domain/`, `shared/` (feature), and `src/app/shared/**` (global UI).
- `application/` → can import `domain/` and `shared/` (feature).
- `infrastructure/` → can import `application/` (ports), `domain/`, `shared/` (feature).
- `shared/` (feature) → can import `domain/` only.
- `config/` → can import all layers for DI wiring.

**Forbidden**

- `domain/` importing Angular/RxJS/HttpClient.
- `ui/` importing `infrastructure/` directly.
- `shared/` (feature) importing `i18n.t()` or UI code.

---

## 3) Providers: contracts and responsibilities

### 3.1 What a gateway must always do

**Rule (target)**

A provider gateway must:

- validate requests (minimum sanity check / required fields),
- normalize errors to `PaymentError` (no translated text),
- map DTO -> domain models,
- log/telemetry **without leaking sensitive data**.

Optional (case-by-case):

- retries/backoff,
- caching,
- timeout/abort.

**Current state:** satisfied; minimal gateway test coverage complete.

---

### 3.2 What providers must not do

**Forbidden**

- touch store/UI/router,
- translate (no `i18n.t`),
- decide fallback,
- mutate module global state.

**Current state:** satisfied.

---

## 4) Fallback policy

**Rule (target)**

- Fallback decisions live **in Application** (XState/orchestrator), never in UI or infra.
- Fallback is only applied when there is a start request available.

**Current state:** `FallbackOrchestratorService` exists and is integrated; fallback is modeled in the machine and projected by the store.

---

## 5) I18n & PaymentError (official contract)

### 5.1 UI-only translation

**Rule (target)**

`i18n.t(...)` is allowed only inside the **UI layer**, which includes:

- `src/app/features/**/ui/**`
- `src/app/shared/**` _(global UI: navbar, language selector, etc.)_

**Forbidden in:**

- `domain/`, `application/`, `infrastructure/`
- `src/app/features/**/shared/**` _(feature shared is NOT UI)_

**Current state:**

- In `payments/`, the rule is satisfied (no `i18n.t` outside `payments/ui/**`).
- In `src/app/shared/**` translation exists and is allowed by this rule.
- Guardrails prevent i18n/messageKey regressions.

---

### 5.2 Official `PaymentError` contract

**Rule (target)**

Errors travel as structured data, never as translated text.

```ts
export type PaymentErrorParams = Record<string, string | number | boolean | null | undefined>;

export interface PaymentError {
  code: string; // stable technical code (provider + normalized)
  messageKey: string; // ALWAYS i18n key (e.g., I18nKeys.errors.provider_error)
  params?: PaymentErrorParams;
  raw?: unknown; // optional raw error from provider
}
```

**Current state:** enforced; guardrails prevent regressions.

Error/message keys live in `shared/constants/payment-error-keys.ts` (`PAYMENT_ERROR_KEYS`, `PAYMENT_MESSAGE_KEYS`, `PAYMENT_SPEI_DETAIL_LABEL_KEYS`). Domain stays agnostic of UI vocabulary; strategies use these constants; the UI translates via i18n.

---

## 5.3 Shared → domain only; SPEI display config

**Rule (target)**

- `shared/` (feature) may only import `domain/`. It must not import `@core` (i18n, logging).
- Provider-specific or environment-specific display data (e.g. SPEI bank names, beneficiary, test CLABE) lives in infrastructure; it is injected into strategies via domain contracts (e.g. `SpeiDisplayConfig`).

**Current state:** Depcruise rule `shared-no-core` forbids payments `shared/` from importing `src/app/core`. Error/message keys are in `shared/constants/`. `SpeiDisplayConfig` lives in `application/api/contracts/`; constants in `infrastructure/fake/shared/constants/spei-display.constants.ts`; `SpeiStrategy` receives optional config from the provider factory.

---

## 6) XState as source of truth

**Rule (target)**

- Flow logic lives in XState.
- Store is projection only (snapshot + fallback + history).
- UI consumes UI-facing ports via tokens (PAYMENT_STATE / PAYMENT_CHECKOUT_CATALOG). Facades may exist as thin wrappers over ports.
- Public commands are separated from internal/system events.

**Current state:** integrated (flow facade + actor + bridge) with command/system event separation.

---

## 7) Guardrails (enforcement)

**Rule (target)**

CI must fail when:

- `i18n.t(` appears outside UI,
- `messageKey` is used as translated text,
- boundary rules are broken.

**Current state:** guardrails are in place (tests + depcruise). Rule `shared-no-core` forbids payments `shared/` from importing `@core`. Policy `intentRequiresUserAction` lives in Domain (`domain/.../policies/requires-user-action.policy.ts`).

---

## 8) Gateway minimum tests (P1)

**Rule (target)**

Per critical operation, at minimum:

- happy path
- invalid request (if applicable)
- provider error -> normalized `PaymentError`
- mapping correctness

**Current state:** coverage exists but is still inconsistent.

---

## 9) Domain folder intent & temporary placeholders

**Rule (target)**

- The **folder** expresses the _intent_ (contracts, entities, primitives, rules, policies, ports).
- The **suffix** expresses the _artifact type_:
  - `*.types.ts` → types/unions/enums.
  - `*.model.ts` → named data structures (entities/aggregates) when needed.
  - `*.event.ts` → domain events / event maps.
  - `*.command.ts` → operation inputs (requests/commands).
  - `*.vo.ts` → value objects / primitives.
  - `*.rule.ts` → pure decision/derivation functions.
  - `*.policy.ts` → boolean gates.
  - `*.port.ts` → boundary interfaces.

**Current state (Domain layout as of 2026-02)**

- `domain/common/`:
  - `primitives/{ids,money,time}` → shared value objects: `Money`, `PaymentIntentId`, `OrderId`, `UrlString`, `TimestampMs`, `FlowId` (see `domain/common/primitives/ids/`, `money/`, `time/`, `url-string.vo.ts`).
  - `ports/` → truly cross-subdomain ports (e.g. token validators).
- `domain/subdomains/payment/`:
  - `messages/` → `payment-request.command.ts` (CreatePaymentRequest, ConfirmPaymentRequest, CancelPaymentRequest, GetPaymentStatusRequest), `payment-webhook.event.ts`.
  - `entities/` → `payment-intent.types.ts`, `payment-flow-context.types.ts`, `payment-error.model.ts`, etc.
  - `rules/`, `policies/`, `ports/` — policies include `requires-user-action.policy.ts`. Error keys in `shared/constants/`; `SpeiDisplayConfig` in `application/api/contracts/`.
- `domain/subdomains/fallback/{contracts,entities,messages,policies,ports}` — messages include `fallback-user-response.command.ts`.

To keep the structure visible while subfolders are still empty, we use **temporary markers**:

- Each placeholder folder may contain a `__folder-intent__.txt` file describing:
  - which suffixes belong there (e.g. `*.vo.ts`, `*.rule.ts`),
  - 1–2 examples of expected artifacts.
- These `.txt` files are **not** imported anywhere and can be safely deleted once real code exists in that folder.

**Value Objects and current contracts**

- **Adopted in domain contracts:** `Money` (CreatePaymentRequest.money, PaymentIntent.money), `PaymentIntentId` (intentId in Confirm/Cancel/GetStatus requests, PaymentIntent.id), `OrderId` (CreatePaymentRequest.orderId).
- **Contracts:** Only interfaces; data lives in entities. Commands in `messages/*.command.ts`; events in `messages/*.event.ts`.
- **Edge validation:** Builders (e.g. `BasePaymentRequestBuilder`) parse raw strings into VOs via `createMoneyOrThrow()`, `createOrderIdOrThrow()`, `createIntentIdOrThrow()`; optional URLs are validated with `UrlString.from()` (returnUrl/cancelUrl remain `string` in contracts; validation happens at Application edge).
- **Guardrails:** `bun run test`, `bun run dep:check`, `bun run lint:fix` must pass.

**Config & DI interplay (reminder)**

- `config/payment.providers.ts` is the **composition root** of the feature.
  - It imports only `provideStripePayments` and `providePaypalPayments` from:
    - `@payments/infrastructure/stripe/di/provide-stripe-payments`
    - `@payments/infrastructure/paypal/di/provide-paypal-payments`
- Each provider’s DI file is the single public entrypoint for its wiring; `config/` does **not** reach into internal folders like `workflows/**` or `methods/**`.
