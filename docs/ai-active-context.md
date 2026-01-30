# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-29

## 📍 Mission State

- **Current mission:** Payments refactor structurally complete (PR0–PR10). Keep tree healthy; resume product work.
- **Key folders:** Domain `domain/**`, Application `application/orchestration/**`, `application/adapters/**`, Infra `infrastructure/**`, Config `config/payment.providers.ts`.

## 🖥️ UI surface & boundaries (current vs intended)

- **Intended:** UI injects PAYMENT_STATE (PaymentFlowPort) for flow state/actions and PAYMENT_CHECKOUT_CATALOG (PaymentCheckoutCatalogPort) for checkout catalog only.
- **Current:** PAYMENT_STATE is FlowPort; CheckoutCatalog is exposed via PAYMENT_CHECKOUT_CATALOG; adapter implements both; UI consumes tokens only, never adapters. Guardrails: ESLint + depcruise forbid UI imports from orchestration/adapters/infra/config and api/testing only in \*.spec.ts.
- **Rule:** UI must not import PaymentsStore, registry, orchestrators, adapters, or selector modules directly.

---

## 🧩 Naming & folder intent (Domain)

- **Suffixes:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,policies,ports}`

---

## ⏭️ Immediate Next Action

- Resume product-level work; add providers/methods per architecture rules. Domain framework-free; UI never imports Infrastructure.
