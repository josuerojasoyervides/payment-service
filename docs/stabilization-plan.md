# Stabilization Plan v3

> **Last review:** 2026-01-26
> Reference branch (historical): `origin/refactor/stabilization-plan-v3`

**Goal:** stabilize and close loops on what already exists so that:

- the module is consistent,
- it is easy to refactor,
- it is ready to migrate complex flow to XState **without rewrites**.

This plan is deliberately aggressive: consistency and testability first, features later.

---

## 0) Baseline invariants

**Key pieces that must not break:**

- Layered architecture (`domain/application/infrastructure/shared/ui/config`)
- PaymentError exists as a contract (`messageKey + params + raw`)
- Fallback triggers only when a start request is available
- Stripe and PayPal already follow **facade + operations** (no PayPal legacy)

**Known gaps:**

- UI still supports legacy error rendering (`message` raw)
- Some paths use `messageKey` as translated text (UI/tests)
- Enforcement (lint/test) was missing to prevent regressions

---

## 1) Workstreams (prioritized)

### 1.1 I18n & errors (closure) — **P0**

**Definition of Done:**

- UI translates once: `i18n.t(error.messageKey, error.params)`
- No `PaymentError.message` in any render path

**Checklist:**

- [P0] Remove legacy compatibility for `message` error rendering
- [P0] Update specs that use text as `messageKey`
- [P1] Add enforcement (see 1.4)

**Status:**

- UI-only translation is enforced (no `i18n.t` outside UI in feature)
- `PaymentError.message` is no longer rendered
- Guardrails are in tests (covers specs outside UI and forbids literals)

---

### 1.2 Provider parity — **P0**

**Goal:** same pattern, same API, same invariants.

- Facade per provider
- Atomic operations (create/confirm/cancel/getStatus)
- Errors normalized to PaymentError keys

**Status:**

- DONE (Stripe and PayPal are aligned)

---

### 1.3 Fallback stability — **P0 done + P1 hardening**

**Goal:** reliable, predictable fallback without weird loops.

**Hardening P1:**

- tests for `maxAttempts`, `maxAutoFallbacks`, and resets
- stable metrics/logs per attempt

**Status:**

- Orchestrator works and is integrated
- Hardening tests are still incomplete

---

### 1.4 Enforcement (guardrails) — **P0/P1**

**Goal:** CI must fail when regressions are introduced.

**Minimum rules for CI:**

- depcruise for boundary rules
- guardrails for i18n/messageKey in tests (includes specs outside UI and forbids literals)

**Status:**

- depcruise exists for general boundaries
- guardrails added in tests

---

### 1.5 Minimal tests per gateway — **P1**

**Goal:** reduce integration bugs per provider.

**Minimum per critical operation:**

- happy path
- invalid request (if applicable)
- provider error -> normalized PaymentError
- correct mapping

**Status:**

- Specs exist for happy path + provider error, but coverage is inconsistent

---

## 2) Definition of Done — Stabilization v3

You can mark this "closed" when all are true:

- PaymentError travels only as `messageKey + params (+ raw)`
- UI-only translation (defined by UI layer)
- No legacy error rendering (`message` raw)
- Fallback policy stable and covered by minimal tests
- Providers parity (Stripe/PayPal) stable
- Guardrails in CI
- Minimal gateway tests (at least most-used operations)
- XState integrated as source of truth + store projection

---

## 3) Final checklist (easy close)

### P0 — Blockers

- [x] Remove legacy error rendering (`message`)
- [x] Remove translated `messageKey` and literal text in specs
- [x] Add minimum enforcement (scan tests / lint)

### P1 — Stability

- [ ] Complete minimal tests for critical gateways
- [ ] Fallback hardening (attempt counters + auto fallback limits)

### P2 — Refinements

- [ ] Stronger typing for `messageKey`
- [x] XState preparation (actors/events mapping)
