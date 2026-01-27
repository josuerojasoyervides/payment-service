# Stripe Flow Findings (Implementation Stress Report)

> Date: 2026-01-27
> Scope: Stripe Card + 3DS flow based on current architecture and newly added Stripe.js adapter

## 1) What was implemented

### 1.1 Stripe flow (current behavior)

- UI builds a `CreatePaymentRequest` using provider builder (Stripe card or SPEI).
- Flow starts via `PaymentFlowFacade.start()` and XState machine.
- Strategy validates request, prepares metadata, and calls gateway.
- Stripe gateway creates a PaymentIntent with `confirm: true` and `return_url` for card.
- If Stripe returns `requires_action`, UI shows NextActionCard.
- For 3DS (`next_action.use_stripe_sdk`), UI calls `StripeJsAdapter.confirmCardPayment()`, then refreshes flow.
- Flow refresh uses `getStatus` to sync final status.

### 1.2 Files touched / core ownership

- UI flow: `src/app/features/payments/ui/pages/checkout/checkout.page.ts`
- UI next action: `src/app/features/payments/ui/components/next-action-card/next-action-card.component.*`
- Adapter: `src/app/features/payments/infrastructure/stripe/adapters/stripe-js.adapter.ts`
- Adapter port/token: `src/app/features/payments/application/api/ports/stripe-js-adapter.port.ts`,
  `src/app/features/payments/application/api/tokens/stripe-js-adapter.token.ts`
- Stripe DTO + mapper updates: `src/app/features/payments/infrastructure/stripe/dto/stripe.dto.ts`,
  `src/app/features/payments/infrastructure/stripe/mappers/next-action.mapper.ts`
- Stripe gateway payload: `src/app/features/payments/infrastructure/stripe/gateways/intent/create-intent.gateway.ts`
- Fake Stripe behavior: `src/app/features/payments/infrastructure/fake/helpers/create-fake-stripe-intent.helper.ts`
- Integration test: `src/app/features/payments/ui/pages/checkout/checkout.page.integration.spec.ts`

## 2) Complexity assessment (what was hard)

### 2.1 Most friction came from the client-side confirmation

- The architecture assumes server-side gateways (HTTP); Stripe 3DS needs client confirmation via Stripe.js.
- This forced UI to call the adapter directly, bypassing application orchestration.
- The refresh step is manual (UI calls `flow.refresh(...)`) because the machine has no event for
  “client confirmed”.

### 2.2 UI needed a Stripe-specific hook

- NextActionCard now emits a specific 3DS event instead of a generic link.
- Checkout page wires that event to Stripe.js confirm call.

### 2.3 Fake gateway had to be altered to simulate real Stripe behavior

- Fake Stripe intents now return `next_action.use_stripe_sdk` to simulate 3DS.
- This forced mapping updates and new test flows.

## 3) Hacks / compromises (explicit)

1. **UI calls Stripe.js directly**
   - Not a clean layer boundary. The UI is now aware of client confirmation semantics.

2. **No flow event for client confirmation**
   - The flow uses a manual refresh after confirm. This is a coordination gap.

3. **Fake Stripe uses deterministic 3DS**
   - Useful for tests but still a bespoke simulation.

## 4) Gaps and risks

- **Stripe.js dependency not managed**: adapter expects `window.Stripe` to exist.
- **Publishable key is runtime-only**: must be injected by app config.
- **No webhooks integration**: polling is used; webhook support is required for real status accuracy.
- **Return URLs**: should be configurable per environment and per flow.
- **State recovery**: user can abandon 3DS flow; no re-entry handler beyond refresh.

## 5) Architectural pressure points

### 5.1 Client confirmation belongs in application layer, not UI

- Ideal: application orchestration emits a `CLIENT_CONFIRM` event.
- UI should only dispatch an intent to confirm, not call adapter directly.

### 5.2 Flow needs a 3DS stage

- Right now it reuses `requiresAction` and `refresh`.
- A dedicated stage could handle: confirm, result mapping, retry or failure,
  and explicit transition to polling/status.

## 6) Recommendations (short-term)

1. Add an application service for client confirmation that wraps Stripe.js adapter
2. Add flow event `CLIENT_CONFIRMED` and handle transitions in machine
3. Add explicit webhook adapter for `payment_intent.succeeded` and `payment_intent.payment_failed`
4. Add tests for:
   - adapter error mapping to PaymentError
   - 3DS confirm -> refresh -> final status

---

# Stripe Official Docs: Complex Flows and Potential Issues

## A) PaymentIntents + 3DS + SCA

**Docs points**:

- `confirmCardPayment` is required for client-side confirmation and handling `next_action`.
- `setup_future_usage` influences SCA and future success rate.

**Risks for our architecture**:

- Need a first-class client confirmation stage, not a UI ad-hoc handler.
- Need to preserve `client_secret` through flow transitions.

## B) Setup Intents (saving cards for later)

**Docs points**:

- Setup Intents require consent collection and `usage` (on_session/off_session).
- Off-session payments may fail without prior authentication.

**Risks for our architecture**:

- We lack a separate “setup” flow and consent tracking.
- No domain model for mandates or explicit permission flags.

## C) Automatic Payment Methods and redirect requirements

**Docs points**:

- Automatic payment methods enabled by default; redirect requirements may appear.
- Some flows require `return_url` or allow disabling redirect methods.

**Risks for our architecture**:

- NextAction needs to support generic redirects beyond 3DS.
- Flow should handle redirect-based methods consistently, not just PayPal.

## D) Webhooks and delayed success

**Docs points**:

- Some payment methods are delayed; you must listen to webhooks to confirm final status.
- Stripe recommends handling `payment_intent.succeeded` and `payment_intent.payment_failed`.

**Risks for our architecture**:

- Current flow relies on polling only.
- No webhook adapter or signature verification layer.

---

# Proposed follow-ups (if we want to harden Stripe)

- Add `StripeClientConfirmService` in application layer.
- Add flow event + state (`clientConfirming` → `afterConfirm` or `failed`).
- Add webhook adapter that maps Stripe events to `ExternalEventAdapter`.
- Extend NextAction domain to support generic redirect flows beyond 3DS and PayPal.
- Add SetupIntent path for “save card for later”.

---

# Sources (official Stripe docs)

```
https://docs.stripe.com/api/payment_intents/create
https://docs.stripe.com/api/payment_intents/confirm
https://docs.stripe.com/js/payment_intents/confirm_card_payment
https://docs.stripe.com/payments/payment-intents
https://docs.stripe.com/payments/setup-intents
https://docs.stripe.com/payments/payment-intents/verifying-status
https://docs.stripe.com/payments/payment-methods
https://docs.stripe.com/changelog/2023-08-16/automatic-payment-methods
```
