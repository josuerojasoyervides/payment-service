# 🧠 Active Context & Session State

> Short snapshot of the **current** mission. Keep it under ~1,500 tokens and treat the code as the source of truth.

---

## 🕒 Last Sync: 2026-01-29

## 📍 Mission State

- **Current mission:** Payments module refactor is structurally complete (PR0–PR10). Keep the tree healthy while resuming product-level work.
- **Last completed steps (high level):**
  - **PR1–PR4 (Application):** `orchestration/flow` → `payment-flow/` buckets; `orchestration/store` → slim root with `actions/`, `types/`, `projection/`, `history/`, `fallback/`; `application/api/tokens` → `provider/`, `flow/`, `operations/`; `application/adapters` → `events/` vs `state/`.
  - **PR5–PR6 (Infrastructure):** Stripe and PayPal re-shaped into `di/`, `workflows/**` (intent/order/redirect), `methods/**`, `errors/**`, `testing/**`, `shared/**`.
  - **PR7–PR7.1 (Config/DI):** `config/payment.providers.ts` now composes `provideStripePayments()` and `providePaypalPayments()` from `infrastructure/<provider>/di/*`; infra no longer imports `config/providers/*`.
  - **PR8–PR10 (Domain + cleanup):** Domain moved to `domain/common/**` + `domain/subdomains/{payment,fallback}/**` with naming-by-suffix (`.types.ts`, `.event.ts`, `.command.ts`, `.vo.ts`, `.rule.ts`, `.policy.ts`, `.port.ts`) and placeholder folders anchored by `__folder-intent__.txt`.
- **Next step:** Use the new structure + naming when adding **provider features** (webhooks, client confirmation, redirect flows) per `architecture-rules.md` and `provider-integration-plan.md`.
- **Key folders/files (today):**
  - Domain: `domain/common/**`, `domain/subdomains/payment/**`, `domain/subdomains/fallback/**`
  - Infra Stripe: `infrastructure/stripe/{di,workflows/intent/**,methods/**,errors/**,shared/**,testing/**}`
  - Infra PayPal: `infrastructure/paypal/{di,workflows/order/**,workflows/redirect/**,methods/redirect/**,errors/**,testing/**}`
  - Testing helpers: `infrastructure/testing/fake-intent-facade.factory.ts`, `infrastructure/**/testing/fake-gateways/**`
  - Config DI edge: `config/payment.providers.ts` (only composes `provideStripePayments` / `providePaypalPayments`).

---

## 🧩 Naming & folder intent (Domain snapshot)

- **Suffix rules (implemented in `domain/**`):\*\*
  - `*.types.ts` → plain types/unions/enums.
  - `*.event.ts` → domain events / event maps.
  - `*.command.ts` → operation inputs (requests/commands).
  - `*.vo.ts` → value objects / primitives.
  - `*.rule.ts` → pure functions that derive/decide/calculate.
  - `*.policy.ts` → boolean gates.
  - `*.port.ts` → boundary interfaces (ports).
- **Folder intent (current layout):**
  - `domain/common/primitives/{ids,money,time}` → shared value objects (IDs, money, time).
  - `domain/common/ports` → cross-subdomain ports (e.g. token validators).
  - `domain/subdomains/payment/{contracts,entities,primitives,rules,policies,ports}`
  - `domain/subdomains/fallback/{contracts,entities,primitives,rules,policies,ports}`
  - Empty-ish buckets are temporarily anchored with `__folder-intent__.txt` describing what belongs there.

---

## ⏭️ Immediate Next Action

- [ ] Pick the next **feature-focused** PR (e.g. webhooks, Stripe client confirmation hardening, or generic redirect flows) and implement it **on top of** the current structure without breaking boundaries:
  - Domain stays framework-free.
  - UI never imports Infrastructure.
  - Application depends only on Domain/Shared, not on Infrastructure.

---

_Note: prune historical details aggressively; this file is only for the latest active context._
