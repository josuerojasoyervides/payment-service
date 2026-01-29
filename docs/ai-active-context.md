# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-29

## 📍 Mission State

- **Current mission:** Payments module refactor structurally complete (PR0–PR10). Keep the tree healthy; resume product-level work.
- **PR6 complete:** Flow telemetry (flowId/providerId/state/event/refs + redaction + InMemory/Console/Noop/Composite sinks); stress suite (idempotency, dedupe, correlation, terminal safety, processing timeout). See `docs/observability/flow-telemetry.md`.
- **Key folders:**
  - Domain: `domain/common/**`, `domain/subdomains/payment/**`, `domain/subdomains/fallback/**`
  - Application: `application/orchestration/flow/**`, `application/adapters/telemetry/**`
  - Infra: `infrastructure/stripe/**`, `infrastructure/paypal/**`
  - Config: `config/payment.providers.ts`

---

## 🧩 Naming & folder intent (Domain)

- **Suffix rules:** `*.types.ts`, `*.event.ts`, `*.command.ts`, `*.vo.ts`, `*.rule.ts`, `*.policy.ts`, `*.port.ts`
- **Folders:** `domain/common/primitives/{ids,money,time}`, `domain/subdomains/{payment,fallback}/{contracts,entities,primitives,rules,policies,ports}`

---

## ⏭️ Immediate Next Action

- Resume product-level work; add providers/methods per architecture rules. Boundaries: Domain framework-free; UI never imports Infrastructure; Application depends only on Domain/Shared.

---

_Note: prune historical details; this file is for latest active context only._
