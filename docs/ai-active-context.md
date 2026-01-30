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

## 🧩 Fake mode (demo)

- **Scenarios (card tokens):** tok_success, tok_3ds (redirect), tok_client_confirm, tok_processing, tok_decline, tok_timeout, tok_insufficient, tok_expired. PaymentIntent.raw includes \_fakeDebug (scenarioId, simulatedDelayMs, correlationId).
- **Showcase:** Cheat sheet of demo tokens (i18n). No provider-branching in UI.

## 🧩 Naming (Domain)

- **Suffixes:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,policies,ports}`

---

## ⏭️ Next

- Resume product work; add providers/methods per architecture rules.
