# Payment Service — Angular payments module (architecture lab)

This repo is a **personal lab** to design and stabilize a real payments module (Stripe + PayPal), built with architecture that is:

- **easy to test**
- **easy to extend** (add providers, methods, rules)
- **hard to break** (guardrails/architecture tests)

Yes: internally there is a lot of abstraction.
The goal is that it feels _hard to enter_ at first, but **very easy to maintain, scale, and change** once you learn the mental map.

## What problem does this architecture solve?

When you add real payments to a project, this usually happens:

1. You handle a simple happy path
2. An edge case appears
3. You add an `if` in the UI
4. Then another `if` in infrastructure

Here the goal is the opposite:

- Add a new provider without rewriting everything
- Keep the module testable even when it grows complex
- Keep errors and i18n consistent (no "anything goes")
- Keep fallback (Stripe -> PayPal) as a central policy, not a UI hack

---

## Getting started

```bash
bun install
bun start
```

The app lazy-loads the payments module and exposes a few demo pages.

> Note: the test runner is based on **Vitest** (see `tsconfig.spec.json`).

---

## Where to start reading (recommended path)

If you open the folder and see 200 files, it is normal to feel lost.
This is a 10-minute tour that usually works:

1. **Module routes (wiring)**
   Here you see what pages exist and where the module providers are loaded.

2. **Providers / DI composition**

3. **Flow Facade (public API for the flow)**
   This is the UI control point: `start`, `confirm`, `cancel`, `refresh`, `reset`.

4. **Use Cases (module verbs)**
   Business flow without UI.

5. **ProviderFactoryRegistry (provider selection)**

---

## Module structure (mental map)

Everything for the feature lives here:

```
src/app/features/payments
├─ config/            # DI wiring (composition)
├─ domain/            # Models, contracts, rules (pure TS)
├─ application/       # Use cases, ports, store, orchestration (no UI)
├─ infrastructure/    # Providers (Stripe/PayPal), mapping, DTOs
├─ shared/            # Shared feature utilities (non-UI)
├─ ui/                # Pages and components (render + translation)
└─ tests/             # Architecture guardrails (boundaries)
```

### Domain (most important)

Domain is the module language. Here you define:

- `PaymentIntent` (payment state)
- `PaymentError` (normalized error)
- request types (`CreatePaymentRequest`, etc.)
- ports like `PaymentRequestBuilder`

### Application

Use cases and orchestration live here:

- `PaymentsStore` (state projection/adapter)

Application **should not know specific providers** (Stripe/PayPal).

### Infrastructure

Implements what Application defines:

- Gateways/facades that talk to Stripe/PayPal
- Error normalization
- Fake gateways (simulation)

### UI

Pages and components:

- UI can import from all layers

---

## Glossary (plain English)

**PaymentIntent**: what is happening with a payment:

- required fields: `id`, `provider`, `status`, `amount`, `currency`
- optional: `redirectUrl` / `nextAction` if extra steps are required (3DS, PayPal approve)

**PaymentError** travels as **data**, not as translated text:

- `messageKey` is a **key**, not final copy
- `params` are serializable values for interpolation

---

## Core architecture rules

- XState is the source of truth for the flow (start/confirm/cancel/refresh/reset).
- `PaymentsStore` only projects snapshot + fallback + history (no orchestration).
- Fallback is modeled as flow states (and uses the orchestrator as policy/telemetry).
- Refresh-from-idle supports context if event keys are missing.
- There are unit tests for the machine and for the bridge/store.

---

## Example: card payment with Stripe

1. UI builds a request (builder or form)
2. UI calls Flow Facade `start()`
3. Actor invokes the Use Case
4. Use Case resolves the ProviderFactory
5. Factory creates the Strategy (and gateways)
6. Infrastructure talks to the provider
7. UI renders the intent

---

## Why does `ProviderFactoryRegistry` exist?

Because the module supports **multiple providers** without filling the UI with `if (stripe)`.

Instead of this:

```ts
if (provider === 'stripe') { ... }
if (provider === 'paypal') { ... }
```

Use this:

```ts
const factory = registry.get(provider);
const strategy = factory.createStrategy(method);
```

**Quick analogy:**
It is like power plugs on a trip:

- You do not want to rewrite your charger per country.
- You want an adapter that gives you the _same output_ even if the plug changes.

---

## What is an Abstract Factory here?

In real life, Stripe and PayPal do not just change one endpoint.
They change several pieces at the same time:

- how the order/intent is created
- required fields (token, returnUrl, email...)
- the approval flow (PayPal redirect / 3DS)
- how status is read
- how errors are normalized

An **Abstract Factory** lets you ask for a **complete compatible package**:

- request builder
- strategy
- gateway set

**The rest of the system never needs to know the provider.**

---

## Why do we have Strategies?

Because **one provider can have multiple methods**:

- card
- SPEI
- PayPal redirect

Each method has different rules, so:

- Strategy A = how to start/confirm card
- Strategy B = how to start SPEI
- Strategy C = PayPal redirect flow

This avoids a giant "god object".

---

## Fallback: "if one provider fails, try another"

This service detects eligible failures and decides:

- **manual mode:** show a modal and let the user choose
- **auto mode:** attempt the next provider automatically

> This logic becomes unmaintainable if it lives in the UI.

---

## Why you may need a State Machine

Payments have states that are **not** linear:

- retries with TTL and timers
- redirects
- back-and-forth between providers

Without a state machine, you end up with flags and impossible combinations like:

"I am in redirect **and** showing a fallback modal."

State machines make it explicit:

- valid states
- events that drive transitions

This repo is already there: XState is the flow source of truth, with polling cadence and retry/backoff modeled in the machine (see docs).

---

## I18n & errors (non-negotiable rule)

### Why?

If infrastructure translates, the text becomes frozen and you cannot:

- change copy without touching code
- test by key/params in a stable way

### So how do we render?

```ts
i18n.t(error.messageKey, error.params);
```

Helpers:

- `renderPaymentError(i18n, error)`

---

## Guardrails: "you cannot add debt without it yelling"

There are tests that act like "import police":

- UI-only translation enforcement
- messageKey must be a key (never translated text)

The goal is to make it _harder to break architecture by accident_.

---

## Pages available (quick test)

- `/payments/checkout` -> main flow
- `/payments/return` -> return from 3DS/PayPal
- `/payments/cancel` -> PayPal cancel
- `/payments/status` -> status by ID
- `/payments/history` -> intent history
- `/payments/showcase` -> component demo

---

## Add a new provider (mini guide)

When you want to add "ProviderX" without breaking the module:

1. Implement infrastructure:
   - gateways/facades + DTO + mappers + error normalization
2. Add minimal tests per operation
3. Register it in config

The rest of the system should stay the same.

---

## Internal docs

If you want the formal version (north star + snapshot):

- `docs/goals.md`
- `docs/architecture-rules.md`

---

## Quick FAQ

### "Why not use services directly in the UI?"

Because payments get chaotic fast. Separation keeps the UI from becoming a god object.

### "Why are there fake providers?"

So you can develop UI + flows + fallback without relying on real APIs.

### "Is this production ready?"

No. This is a learning/architecture project. **Do not use it as a real payments library without hardening.**
