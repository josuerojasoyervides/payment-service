# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-30

## 📍 Mission State

- **Current mission:** Payments refactor complete. UI demo + state machine + fakes. Keep tree healthy; resume product work.
- **Key folders:** Domain `domain/**`, Application `application/orchestration/**`, `application/adapters/**`, Infra `infrastructure/**`, Config `config/payment.providers.ts`.

## 🖥️ UI surface & boundaries (UI-01)

- **Tokens:** PAYMENT_STATE (FlowPort), PAYMENT_CHECKOUT_CATALOG (CatalogPort). Config wires both via useExisting to one adapter.
- **PaymentFlowPort** exposes derived intent selectors: requiresUserAction, isSucceeded, isProcessing, isFailed (Signal<boolean>).
- **Checkout** uses FlowPhase derived from PaymentFlowPort selectors (phase-driven UI); showResult is derived from flowPhase.
- **UI runtime:** No provider identifiers (stripe/paypal/mercadopago) and no provider-specific query keys (payment_intent, PayerID, redirect_status, etc.) in UI runtime. Return page does not parse query params by provider; uses port `getReturnReferenceFromQuery(normalized)` + `notifyRedirectReturned(normalized)`; on init calls `refreshPayment` when referenceId exists. Status/Return/Showcase: provider list and labels from catalog only.
- **Guardrail:** `ui-provider-coupling.spec.ts` covers status/return/showcase (ts+html), bans provider names and provider-specific keys; excludes \*.spec.ts and \*.integration.spec.ts.
- **Rule:** UI must not import infrastructure; api/testing only in \*.spec.ts.

## 🧩 Application layer (clean layering)

- **Adapters no dependen de I18nKeys:** Ningún archivo bajo `application/**` importa `@core/i18n` o `I18nKeys`. Errores usan `messageKey` como string literal (ej. `'errors.missing_provider'`, `'errors.timeout'`). La UI traduce con `i18n.t(error.messageKey)`.

## 🧩 Fake mode (demo)

- **FakeIntentStore determinístico:** processing y client_confirm. El store en memoria (`FakeIntentStore`) controla transiciones: processing → refresh N veces → succeeded; client_confirm → markClientConfirmed + refresh → succeeded. PaymentIntent.raw incluye \_fakeDebug (scenarioId, stepCount, correlationId).
- **Scenarios (card tokens):** tok_success, tok_3ds (redirect), tok_client_confirm / tok_clientconfirm (alfa), tok_processing, tok_decline, tok_timeout, tok_insufficient, tok_expired.
- **Scenario matrix cubre esos flows:** checkout.page.integration.spec.ts — "Scenario matrix (fake tokens) — FakeIntentStore deterministic": tok_success, tok_processing (refresh 2x → succeeded), tok_client_confirm, tok_timeout, tok_3ds. Aserciones: isReady/hasError, historyCount, debugSummary (provider, status, intentId), \_fakeDebug.stepCount cuando aplica.
- **Showcase:** Cheat sheet de tokens demo (i18n). No provider-branching en UI.

## 🧩 Naming (Domain)

- **Suffixes:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,policies,ports}`

---

## ⏭️ Next

- Resume product work; add providers/methods per architecture rules.
