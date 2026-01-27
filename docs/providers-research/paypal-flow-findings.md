# PayPal Flow Findings (Implementation Stress Report)

> Date: 2026-01-27
> Scope: PayPal Orders v2 redirect flow (create → approve → capture → refresh/webhook)

## 1) What was implemented

### 1.1 PayPal flow (current behavior)

- UI builds a `CreatePaymentRequest` for PayPal via `PaypalRedirectStrategy`.
- Strategy validates currency/amount and requires `return_url`/`cancel_url` from `StrategyContext`.
- Gateway creates an Order (`/orders`) and returns approval URL.
- Intent is enriched with `nextAction.paypal_approve` and `redirectUrl`.
- After user approves and returns, the Return page auto-confirms (capture) using `PaymentFlowFacade.confirmWith()`.
- Capture response maps to `succeeded`; flow transitions to `done`.
- Refresh (`getStatus`) returns `APPROVED` before capture, and `COMPLETED` after capture.

### 1.2 Files touched / core ownership

- UI return handler: `src/app/features/payments/ui/pages/return/return.page.ts`
- Flow facade (explicit confirm): `src/app/features/payments/application/orchestration/flow/payment-flow.facade.ts`
- Status UI confirm fix: `src/app/features/payments/ui/pages/status/status.page.ts`
- Fake PayPal capture state: `src/app/features/payments/infrastructure/fake/helpers/paypal-order-state.helper.ts`
- Fake confirm/get status: `src/app/features/payments/infrastructure/fake/gateways/intent/*.gateway.ts`
- Integration tests: `src/app/features/payments/ui/pages/checkout/checkout.page.integration.spec.ts`
- Unit tests: `src/app/features/payments/ui/pages/return/return.page.spec.ts`,
  `src/app/features/payments/ui/pages/status/status.page.spec.ts`

## 2) Complexity assessment (what was hard)

### 2.1 Approval → capture is not modeled in the flow machine

- PayPal returns to the site after approval, but capture must be explicitly called.
- The flow machine has no “approved → capture” event, so we had to do it in the Return page.

### 2.2 Approval is an external redirect, not a local UI action

- There is no client SDK confirmation (unlike Stripe), so the decision is external.
- The return URL is the only signal to continue the flow.

## 3) Hacks / compromises (explicit)

1. **Return page auto-captures for PayPal**
   - This is a UI-triggered action because we lack a machine event that captures on approval.

2. **Refresh vs capture race**
   - We disable refresh on PayPal return to avoid a race with capture.

3. **Fake PayPal needed state to preserve capture**
   - We introduced a small in-memory state store to ensure refresh returns `COMPLETED` after capture.

## 4) Gaps and risks

- **No webhook integration**: PayPal strongly relies on webhooks for final state.
- **No event for “approved” in machine**: capture is triggered from UI, not from flow policy.
- **No retry policy for capture**: capture errors are handled as generic failures.
- **Return URL trust**: we assume any return implies approval; no validation of token ownership.

## 5) Architectural pressure points

### 5.1 Approval is a provider-specific step

- The flow is provider-agnostic, but PayPal needs an approval->capture stage.
- This shows a missing abstraction for “provider approval completed”.

### 5.2 External approval should be modeled as a system event

- Ideal: ExternalEventAdapter receives a PayPal-approved event (return/webhook) and the machine
  transitions to capture.

## 6) Recommendations (short-term)

1. Add a `PAYPAL_APPROVED` system event + flow state that auto-captures
2. Move return auto-capture from UI into application orchestration
3. Add webhook adapter for `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`
4. Add capture retry/backoff policy (especially for network failures)

---

# PayPal Official Docs: Complex Flows and Potential Issues

## A) Orders v2 (create → approve → capture)

**Docs points**:

- You must create an order and redirect the buyer to the approval URL.
- After approval, you must capture the order to complete payment.

**Risks for our architecture**:

- We need a first-class “approved → capture” flow step.
- Approval URL is required for UX; we must always map it to `nextAction`.

## B) Webhooks for final state

**Docs points**:

- PayPal emits events such as `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`.

**Risks for our architecture**:

- Current flow relies on polling; no webhook adapter or signature verification.

## C) 3D Secure (Advanced Card Payments)

**Docs points**:

- 3D Secure is required for Advanced Card Payments, not for PayPal Checkout redirect.

**Risks for our architecture**:

- If we move to advanced card fields, we need a client-side confirmation step
  similar to Stripe (new adapter + flow stage).

---

# Proposed follow-ups (if we want to harden PayPal)

- Add `PaypalApprovalService` in application layer with auto-capture.
- Add webhook adapter that maps PayPal events to `ExternalEventAdapter`.
- Add explicit `APPROVED` and `CAPTURED` states in the flow machine.
- Add token ownership validation (payer ID / order id consistency).

---

# Sources (official PayPal docs)

```
https://developer.paypal.com/docs/checkout/standard/integrate/
https://developer.paypal.com/docs/api/orders/v2/
https://developer.paypal.com/docs/api/orders/v2/#orders_capture
https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events
https://developer.paypal.com/docs/checkout/advanced/3d-secure/
```
