# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-30

## 📍 Mission State

- **Current mission:** Payments refactor complete. UI demo + state machine + fakes. PR6 adds flow telemetry contract (Phase A done).
- **Key folders:** Domain `domain/**`, Application `application/orchestration/**`, `application/adapters/**`, `application/observability/telemetry/**`, Config `config/payment.providers.ts`.

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

## 🧩 PR6 — Flow telemetry (Phase A)

- **Contract:** `FlowTelemetryEvent` + `FlowTelemetrySink` (emit) + strict sanitizer in `application/observability/telemetry/`.
- **Event types:** FLOW_STARTED, COMMAND_RECEIVED, SYSTEM_EVENT_RECEIVED, INTENT_UPDATED, POLL_ATTEMPTED, FINALIZE_REQUESTED, FINALIZE_SKIPPED, FALLBACK_STATUS, FLOW_SUCCEEDED, FLOW_FAILED. JSON-serializable; provider-agnostic.
- **Sanitizer:** `sanitizeTelemetryPayloadForSink` — shallow allowlist (providerId, referenceId, eventId, returnNonce, operation, attempt, reason, status, code, messageKey). Never: raw, headers, clientSecret, token, email, authorization, request, response.
- **Sinks:** NullTelemetrySink, InMemoryTelemetrySink (all/ofType/last/clear), optional ConsoleTelemetrySink. Token `PAYMENTS_FLOW_TELEMETRY_SINK`; default Null sink in config.
- **Phase B:** Flow instrumented with minimal telemetry events (FLOW_STARTED, COMMAND_RECEIVED, SYSTEM_EVENT_RECEIVED, POLL_ATTEMPTED, FLOW_SUCCEEDED/FLOW_FAILED); default Null sink wired; tests use InMemory sink.
- **Phase C:** Deterministic scenario harness (orchestration/testing) + stress specs for idempotency and correlation mismatch; asserts invariants + telemetry.
- **Phase D:** Chaos fakes (scheduleDelayedWebhook, createFlakyStatusUseCaseFake, OutOfOrder) + mega scenario + docs for resilience suite.

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
