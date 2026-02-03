# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-02-02

## 📍 Mission State

- **Current mission:** Domain sanitized (UI-agnostic, fallback naming); Value Objects adopted in core contracts: Money, PaymentIntentId, OrderId. Domain agnostic of UI vocabulary; error keys in `shared/constants/`; SpeiDisplayConfig in `presentation/contracts/` (deprecated re-export in `application/api/contracts/`); depcruise `shared-no-core` enforced.
- **Key folders:** Domain `domain/**` (policies: `requires-user-action.policy.ts`), Shared `shared/constants/payment-error-keys.ts`, Application `application/orchestration/**` + `application/api/**` (ports/tokens/contracts), Presentation `presentation/contracts/**`, Config `config/payment.providers.ts`, Infra constants `infrastructure/fake/shared/constants/spei-display.constants.ts`.

## 🖥️ UI surface & boundaries (UI-01)

- **Tokens:** PAYMENT_STATE (FlowPort), PAYMENT_CHECKOUT_CATALOG (CatalogPort). Config wires both via useExisting to one adapter.
- **PaymentFlowPort** exposes derived intent selectors: requiresUserAction, isSucceeded, isProcessing, isFailed (Signal<boolean>).
- **Checkout** uses FlowPhase from PaymentFlowPort selectors; showResult from flowPhase. Resume banner: canResume / resumeIntentId / resumeProviderId when flowPhase === 'editing'. Processing panel with refresh CTA when flowPhase === 'processing'.
- **PaymentForm** emits PaymentOptions from FieldRequirements.fields (no hardcoded keys). Checkout surfaces fallback status (auto/manual) via banner.
- **FlowDebugPanel** shows machine state node/tags/last event via port; debugLastEventPayload is allowlisted; no secrets/raw in UI.
- **UI runtime:** No provider identifiers or provider-specific query keys. Return page uses `toRedirectReturnRaw()` + `notifyRedirectReturned(raw)`; infra normalizers map provider keys; no auto-refresh on init; refresh is manual CTA. Status/Return/Showcase: catalog only.
- **Guardrail:** `ui-provider-coupling.spec.ts` bans provider names and provider-specific keys in status/return/showcase (ts+html).
- **Rule:** UI must not import infrastructure; api/testing only in \*.spec.ts.

## 🧩 Application layer (clean layering)

- **Adapters:** No `@core/i18n` or I18nKeys in `application/**`. Errors use `messageKey` string; UI translates with `i18n.t(error.messageKey)`.

## 🧩 Domain boundaries (shared → domain only)

- **Error / message keys:** Shared defines `PAYMENT_ERROR_KEYS`, `PAYMENT_MESSAGE_KEYS`, `PAYMENT_SPEI_DETAIL_LABEL_KEYS` in `shared/constants/payment-error-keys.ts`. Domain stays agnostic; strategies import from Shared; UI translates via i18n. No `@core/i18n` in shared.
- **Policy:** `intentRequiresUserAction(intent)` in `domain/.../policies/requires-user-action.policy.ts`; strategies use it as base for `requiresUserAction()`.
- **Shared-no-core:** Depcruise rule `shared-no-core` forbids payments `shared/` from importing `src/app/core`. IdempotencyKeyFactory no longer uses LoggerService/TraceOperation from @core.
- **SPEI display config:** `SpeiDisplayConfig` in `presentation/contracts/spei-display-config.types.ts` (deprecated re-export in `application/api/contracts/`); constants in `infrastructure/fake/shared/constants/spei-display.constants.ts`; SpeiStrategy receives config via constructor (optional; defaults in tests).

## 🧩 PR6 — Flow telemetry (PR2 done)

- **Contract:** `FlowTelemetryEvent` (kind/eventType/refs/meta) + `FlowTelemetrySink` (record) in `application/adapters/telemetry/types/flow-telemetry.types.ts`. Token `FLOW_TELEMETRY_SINK`; default NoopFlowTelemetrySink in config. No legacy observability/telemetry folder.
- **Kinds:** COMMAND_SENT, SYSTEM_EVENT_SENT, STATE_CHANGED, EFFECT_START, EFFECT_FINISH, ERROR_RAISED. Correlation via `refs.referenceId` / `refs.eventId`; no raw payloads.
- **Tests:** All flow telemetry tests use FLOW_TELEMETRY_SINK + InMemoryFlowTelemetrySink (scenario harness + actor telemetry spec). Assert on `telemetry.ofKind(...)`, `telemetry.lastKind(...)`, `event.refs?.['referenceId']`.
- **Docs:** `docs/observability/flow-telemetry.md` describes event kinds and InMemoryFlowTelemetrySink; scenario harness uses `telemetry.ofKind(...)`, `telemetry.lastKind(...)`.

## 🧩 Fake mode (demo)

- **FakeIntentStore:** processing, client_confirm; PaymentIntent.raw has \_fakeDebug (scenarioId, stepCount, correlationId).
- **Scenarios:** tok_success, tok_3ds, tok_client_confirm, tok_processing, tok_timeout, tok_decline, etc. Matrix in checkout.page.integration.spec.ts.
- **Showcase:** Cheat sheet demo (i18n); no provider-branching.

## 🧩 Naming (Domain)

- **Suffixes:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/subdomains/{payment,fallback}/{contracts,entities,messages,rules,policies,ports}` — messages hold `*.command.ts` and `*.event.ts`; entities hold `*.types.ts` and `*.model.ts`.
- **VOs adopted in contracts:** `Money`, `PaymentIntentId`, `OrderId` in `domain/common/primitives/`; used in `CreatePaymentRequest`, `ConfirmPaymentRequest`, `CancelPaymentRequest`, `GetPaymentStatusRequest`, `PaymentIntent` (see `domain/subdomains/payment/messages/payment-request.command.ts` and `entities/payment-intent.types.ts`).
- **Contracts:** Error/message keys in `shared/constants/payment-error-keys.ts`; `SpeiDisplayConfig` in `presentation/contracts/spei-display-config.types.ts` (deprecated re-export in `application/api/contracts/`).

---

## ⏭️ Next

- Resume product work; add providers/methods per architecture rules.
