# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-29

## 📍 Mission State

- **Current mission:** Payments refactor structurally complete (PR0–PR10). Keep tree healthy; resume product work.
- **Key folders:** Domain `domain/**`, Application `application/orchestration/**`, `application/adapters/**`, Infra `infrastructure/**`, Config `config/payment.providers.ts`.

## 🖥️ UI surface & boundaries (current vs intended)

- **Intended:** UI should inject PAYMENT_STATE (PaymentStorePort) for reactive state and actions.
- **Current:** ReturnPage, StatusPage, and Checkout use PAYMENT_STATE. Guardrails: ESLint + depcruise forbid UI imports from orchestration/adapters/infra/config and forbid runtime imports from application/api/testing/\*_ (testing only in _.spec.ts).
- **Rule:** UI must not import PaymentsStore, registry, orchestrators, adapters, or selector modules directly.

---

## 🧩 Naming & folder intent (Domain)

- **Suffixes:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,policies,ports}`

---

## ⏭️ Immediate Next Action

- Resume product-level work; add providers/methods per architecture rules. Domain framework-free; UI never imports Infrastructure.
