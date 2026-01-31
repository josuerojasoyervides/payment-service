# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-31

## 📍 Mission State

- **Current mission:** PR2 done — legacy flow telemetry (observability/telemetry folder) removed. Only FLOW_TELEMETRY_SINK remains.
- **Key folders:** Domain `domain/**`, Application `application/orchestration/**`, `application/adapters/telemetry/**`, `application/api/tokens/telemetry/**`, Config `config/payment.providers.ts`.

## 🖥️ UI surface & boundaries (UI-01)

- **Tokens:** PAYMENT_STATE (FlowPort), PAYMENT_CHECKOUT_CATALOG (CatalogPort). Config wires both via useExisting to one adapter.
- **PaymentFlowPort** exposes derived intent selectors: requiresUserAction, isSucceeded, isProcessing, isFailed (Signal<boolean>).
- **Checkout** uses FlowPhase from PaymentFlowPort selectors; showResult from flowPhase. Resume banner: canResume / resumeIntentId / resumeProviderId when flowPhase === 'editing'. Processing panel with refresh CTA when flowPhase === 'processing'.
- **PaymentForm** emits PaymentOptions from FieldRequirements.fields (no hardcoded keys). Checkout surfaces fallback status (auto/manual) via banner.
- **FlowDebugPanel** shows machine state node/tags/last event via port; debugLastEventPayload is allowlisted; no secrets/raw in UI.
- **UI runtime:** No provider identifiers or provider-specific query keys. Return page uses port `getReturnReferenceFromQuery(normalized)` + `notifyRedirectReturned(normalized)`; no auto-refresh on init; refresh is manual CTA. Status/Return/Showcase: catalog only.
- **Guardrail:** `ui-provider-coupling.spec.ts` bans provider names and provider-specific keys in status/return/showcase (ts+html).
- **Rule:** UI must not import infrastructure; api/testing only in \*.spec.ts.

## 🧩 Application layer (clean layering)

- **Adapters:** No `@core/i18n` or I18nKeys in `application/**`. Errors use `messageKey` string; UI translates with `i18n.t(error.messageKey)`.

## 🧩 PR6 — Flow telemetry (PR2 done)

- **Contract:** `FlowTelemetryEvent` (kind/eventType/refs/meta) + `FlowTelemetrySink` (record) in `application/adapters/telemetry/types/flow-telemetry.types.ts`. Token `FLOW_TELEMETRY_SINK`; default NoopFlowTelemetrySink in config. No legacy observability/telemetry folder.
- **Kinds:** COMMAND_SENT, SYSTEM_EVENT_SENT, STATE_CHANGED, EFFECT_START, EFFECT_FINISH, ERROR_RAISED. Correlation via `refs.referenceId` / `refs.eventId`; no raw payloads.
- **Tests:** All flow telemetry tests use FLOW_TELEMETRY_SINK + InMemoryFlowTelemetrySink (scenario harness + actor telemetry spec). Assert on `telemetry.ofKind(...)`, `telemetry.lastKind(...)`, `event.refs?.['referenceId']`.
- **Docs:** `docs/pr6-resilience-suite.md` describes kind vocabulary and InMemoryFlowTelemetrySink helpers.

## 🧩 Fake mode (demo)

- **FakeIntentStore:** processing, client_confirm; PaymentIntent.raw has \_fakeDebug (scenarioId, stepCount, correlationId).
- **Scenarios:** tok_success, tok_3ds, tok_client_confirm, tok_processing, tok_timeout, tok_decline, etc. Matrix in checkout.page.integration.spec.ts.
- **Showcase:** Cheat sheet demo (i18n); no provider-branching.

## 🧩 Naming (Domain)

- **Suffixes:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,policies,ports}`

---

## ⏭️ Next

- Resume product work; add providers/methods per architecture rules.
