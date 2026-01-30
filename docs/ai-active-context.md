# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-29

## 📍 Mission State

- **Current mission:** Payments refactor complete. UI demo + state machine leverage + fakes for complex scenarios. Keep tree healthy; resume product work.
- **Key folders:** Domain `domain/**`, Application `application/orchestration/**`, `application/adapters/**`, Infra `infrastructure/**`, Config `config/payment.providers.ts`.

## 🖥️ UI surface & boundaries

- **Tokens:** PAYMENT_STATE (FlowPort), PAYMENT_CHECKOUT_CATALOG (CatalogPort). Config wires both via useExisting to one adapter.
- **UI:** Return/Status/Checkout use ports only; error surface (renderPaymentError + Try again / Clear error); confirm/cancel/refresh use optional providerId (adapter resolves). FlowDebugPanel (dev) on checkout, status, return shows debugSummary, history, actions (reset, clearError, clearHistory).
- **Rule:** UI must not import orchestration/adapters/infra/config; api/testing only in \*.spec.ts.

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
