# PR Title

<!-- Example: "Stabilize PaymentError mapping in UI + tests" -->

## 🎯 Change objective

<!-- Explain the real purpose of the PR in 1–3 lines -->

-

## 🧠 Context / why it was needed

<!-- What problem are we solving and why it matters -->

-

## ✅ Scope (what it includes)

<!-- Explicit list of what you changed -->

- [ ]
- [ ]

## 🚫 Out of scope (what it does NOT include)

<!-- Avoid scope creep -->

- [ ] No new features added
- [ ] No massive refactor
- [ ] No contract changes unless necessary and documented

---

## 🏗️ Architecture / rules (required checklist)

### Layers and dependencies

- [ ] Domain remains pure TypeScript (no Angular/RxJS/Http/i18n/logger)
- [ ] Application depends only on Domain
- [ ] Infrastructure depends on Application + Domain
- [ ] UI depends only on Application

### OCP and extensibility

- [ ] I did not add `switch(providerId)` in use cases
- [ ] I did not introduce giant provider/method `if/else`
- [ ] Adding a provider/method is easier after this PR

### Errors and stability

- [ ] Infra normalizes errors to `PaymentError`
- [ ] `PaymentError` keeps stable shape: `{ code, providerId, messageKey, raw, stacks }`
- [ ] I did not introduce `any` / `as any` / hacks to move forward
- [ ] No sync throws escape the stream (use cases use `safeDefer` or equivalent)
- [ ] Fallback rule respected:
  - [ ] fallback handled -> `EMPTY`
  - [ ] fallback not handled -> error propagate

### UX (avoid infinite loading)

- [ ] No infinite loading
- [ ] Timeouts applied per operation:
  - [ ] start payment -> ~15s
  - [ ] confirm/cancel -> 10–15s
  - [ ] get status -> ~30s
- [ ] On timeout, the user can retry or fallback

---

## 🧪 Tests (required checklist)

### Unit tests

- [ ] Relevant unit tests added/updated
- [ ] I did not force 100% coverage: I tested core and important edge cases

### Operations vs Adapter (Stripe rule)

- [ ] Operations (HTTP) tested with `HttpTestingController` (if applicable)
- [ ] Adapter/Facade tested with mocks and delegation (no HTTP) (if applicable)

### Integration specs

- [ ] Key happy path(s) covered/updated
- [ ] Relevant edge case(s) covered/updated

### Execution

- [ ] `bun run test` passes locally
- [ ] No "Unhandled errors" in Vitest

---

## 📦 Files / modules touched

<!-- List key files (not exhaustive) -->

- `...`
- `...`

---

## 🧩 Important decisions

<!-- If you made an architectural decision, write it here. -->

- ***

## ⚠️ Risks / possible regressions

<!-- What could break with this change -->

-

## 🛡️ Mitigations

<!-- What you did to minimize risk -->

- ***

## 📝 Notes for reviewer / AI

<!-- Tips to review or continue work -->

- ***

## ✅ Definition of Done (DoD)

- [ ] Tests green
- [ ] Contracts intact or documented
- [ ] No new active tech debt introduced
- [ ] Incremental and maintainable change
- [ ] Real improvement in stability or extensibility
