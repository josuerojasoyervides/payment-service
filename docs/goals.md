# Goals and North Star

> **Last review:** 2026-01-26
> Strategic document: defines **why** this module exists, the **North Star**, and how to evolve without breaking what already works.

## How to use this doc

- This is a guide + intent history.
- When the code drifts from the North Star, this doc should:
  - record the deviation,
  - explain why it was accepted,
  - define the closure plan (how to realign).

---

## 1) Project purpose

This repository exists to practice real-world payments architecture (not just "make it work").

We want the module to be:

- **extensible** (add providers/methods without touching everything),
- **stable** (reliable tests, no zombie states, normalized errors),
- **maintainable** (clear boundaries; refactors without ripple effects),
- a lab to learn **pragmatic clean-ish architecture**.

Minimum scope:

- Stripe + PayPal

**North Star:** adding a new provider should be:

- add minimal tests
- avoid touching UI/store in 20 places

---

## 2) Contract goals

### 2.1 Stable error contract (PaymentError)

Infra/App must return `PaymentError` with:

- `code`
- `messageKey`
- `params?`
- `raw?`

UI is the only layer that translates.

---

### 2.2 Robust state/flow (XState)

**Reason:** payments have too many real intermediate states:

- redirects
- retries with TTL
- polling
- fallbacks

**North Star with XState:**

- explicit flow (real statechart)
- no impossible states

**Keep in NgRx Signals:**

- UI state/screens
- component data shape
- read API (selectors)

**Live in XState:**

- payment lifecycle (start -> action -> confirm/cancel -> polling -> done/fail)
- branching per provider/method

**Rules:**

- XState is the flow source of truth.
- Store is snapshot projection only (no orchestration).
- Fallback is modeled in the flow and uses the orchestrator as policy/telemetry.

---

## 3) Roadmap by phase (incremental, no rewrites)

### Phase A — Stabilization & consistency (P0/P1)

**Goal:** make the module reliable and consistent before adding complex flow.

**Definition of Done (Phase A North Star):**

- PaymentError travels only as `messageKey + params (+ raw)`
- UI-only translation (defined by UI layer, not folder literal)
- Providers follow the same pattern (facade + operations)
- Minimal tests for critical gateways

**Current status:**

- Providers are standardized
- Enforcement is in place
- Gateway minimal tests are still incomplete

### Phase B — Guardrails & enforcement

**Goal:** avoid regressions without relying on manual discipline.

- tests/lint fail if `i18n.t(` is outside UI
- tests/lint fail if `messageKey` is used as translated text
- depcruise consolidated with real North Star rules

### Phase C — XState migration

**Goal:** migrate "payment as workflow" into a state machine.

- keep store as bridge (do not break UI)
- model fallback inside the flow

---

## 4) Success metrics

- Add a new provider without touching UI/store everywhere
- Reduce zombie-state bugs
- Refactors do not break tests
- UI does not need to know **how** payment happens, only **what** to render

---

## 5) Known debt (intentional)

This is not "bad", it is **conscious debt** (must have a plan):

- Legacy rendering of `PaymentError.message` (must die)
- Some specs with `messageKey` as text (must be fixed)

---

## 6) Next recommended checkpoint

If you had to close a full cycle today:

1. **Complete minimal tests for critical gateways**
2. **Fallback hardening** (attempt counters + auto fallback limits)
