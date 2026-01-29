# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-29

## 📍 Mission State

- **Current mission:** Payments module refactor structurally complete (PR0–PR10). Keep the tree healthy; resume product-level work.
- **PR5 complete:** Webhooks normalization + processing resolution. Tests + lint green. ExternalEventAdapter emits REDIRECT_RETURNED / WEBHOOK_RECEIVED / EXTERNAL_STATUS_UPDATED only; machine consumes them → reconciling/finalizing. WEBHOOK_NORMALIZER_REGISTRY (Stripe + PayPal) in config; processing_timeout policy + tests.
- **Next: PR6 — Observability + stress suite.** Branch: `task/flow-observability`. Exit: logs/telemetry include flowId/providerId/state/event/refs; stress scenario suite runs deterministically.
- **Key folders (today):**
  - Domain: `domain/common/**`, `domain/subdomains/payment/**`, `domain/subdomains/fallback/**`
  - Infra: `infrastructure/stripe/**`, `infrastructure/paypal/**` (di, workflows, methods, errors, testing)
  - Config: `config/payment.providers.ts` (provideStripePayments / providePaypalPayments only)

---

## 🧩 Naming & folder intent (Domain)

- **Suffix rules:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/common/ports`, `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,policies,ports}`

---

## ⏭️ Immediate Next Action

- [ ] PR6: Add flow telemetry (flowId/providerId/state/event/refs) and deterministic stress scenario suite.
- Boundaries: Domain framework-free; UI never imports Infrastructure; Application depends only on Domain/Shared.

---

_Note: prune historical details; this file is for latest active context only._
