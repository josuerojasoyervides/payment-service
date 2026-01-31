# PayPal Flow Findings (Implementation Stress Report)

> Date: 2026-01-27
> Scope: PayPal Orders v2 redirect flow (create → approve → capture → refresh/webhook)

## 1) What was implemented

### 1.1 PayPal flow (current behavior)

- UI builds a `CreatePaymentRequest` for PayPal via `PaypalRedirectStrategy`.
- Strategy validates currency/amount and requires `return_url`/`cancel_url` from `StrategyContext`.
- Gateway creates an Order (`/orders`) and returns approval URL.
- Intent is enriched with `nextAction` (e.g. redirect) and `redirectUrl`.
- After user approves and returns, the **Return page** maps query params to a reference (e.g. token/order id) via `mapReturnQueryToReference` and emits **`ExternalEventAdapter.redirectReturned({ providerId, referenceId })`**. It does **not** call `confirmWith()` or perform PayPal capture; the **machine** handles finalize/reconciling on `REDIRECT_RETURNED`.
- The machine transitions to finalizing/reconciling and then to terminal; `getStatus` is used by the flow as needed.

### 1.2 Files touched / core ownership

- Return page: `return.page.ts` — maps query → referenceId, calls `externalEvents.redirectReturned(...)` (no confirm/capture).
- Flow facade: `payment-flow-machine-driver.ts` (commands: start, confirm, cancel, refresh, reset).
- External events: `application/adapters/events/external-event.adapter.ts` (redirectReturned, externalStatusUpdated, webhookReceived).
- Machine: owns REDIRECT_RETURNED → finalizing/reconciling.
- Fakes/tests: infrastructure fake gateways; return.page.spec.ts, checkout/status specs as needed.

## 2) Complexity assessment (what was hard)

### 2.1 Approval → capture is now machine-owned

- PayPal returns to the site after approval. The **Return page** only emits `redirectReturned(providerId, referenceId)`; the **machine** handles the “return → finalize/reconcile” path (REDIRECT_RETURNED → finalizing → reconcilingInvoke → done/failed). No provider-specific confirm or capture in the UI.

### 2.2 Approval is an external redirect, not a local UI action

- There is no client SDK confirmation (unlike Stripe); the return URL is the signal. The UI’s only job is to map query params to a reference and emit the system event; the machine does the rest.

## 3) Hacks / compromises (explicit)

- **Return page:** Does **not** auto-capture or call provider-specific confirm. It maps query → referenceId and emits `redirectReturned`; the machine performs finalize/reconciling. No REFRESH workaround.
- **Fakes/tests:** Fakes may still maintain in-memory state for getStatus/finalize behavior in tests; this is test scaffolding, not production UI coordination.

## 4) Gaps and risks

- **Webhook integration**: Webhook normalization exists (PR5: WEBHOOK_NORMALIZER_REGISTRY, PaypalWebhookNormalizer); ingestion feeds `ExternalEventAdapter.webhookReceived`. Signature verification and production hardening remain case-by-case.
- **Return → finalize**: Machine owns REDIRECT_RETURNED → finalizing/reconciling; not triggered from Return page.
- **Retry policy for capture**: Capture/finalize errors are handled by the machine; retry policy is in flow policy.
- **Return URL trust**: Correlation/dedupe guards in machine (e.g. return reference mismatch → failed); token ownership validation can be strengthened per provider.

## 5) Architectural pressure points

### 5.1 Approval → finalize is machine-owned

- The flow is provider-agnostic. “Approval completed” is modeled as `REDIRECT_RETURNED` (return) or `WEBHOOK_RECEIVED` / `EXTERNAL_STATUS_UPDATED` (webhook). The machine transitions to finalizing/reconciling; no provider-specific logic in the Return page.

### 5.2 External approval is a system event

- Implemented: ExternalEventAdapter receives return (query → referenceId → redirectReturned) or webhook (normalizer → webhookReceived); machine handles transitions.

## 6) Recommendations (short-term)

1. ~~Add PAYPAL_APPROVED / return auto-capture~~ — Done: REDIRECT_RETURNED + machine finalize/reconciling; Return page only emits redirectReturned.
2. Webhook adapter: PaypalWebhookNormalizer + WEBHOOK_NORMALIZER_REGISTRY in place; map PayPal events to webhookReceived payloads as needed.
3. Harden capture/finalize retry in flow policy and gateway where applicable.

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

- Webhook adapter already maps to ExternalEventAdapter.webhookReceived; extend PaypalWebhookNormalizer for more event types as needed.
- Machine already has finalizing/reconciling; no separate APPROVED/CAPTURED states required for redirect flow.
- Add token ownership validation (payer ID / order id consistency) where required.

---

# Sources (official PayPal docs)

```
https://developer.paypal.com/docs/checkout/standard/integrate/
https://developer.paypal.com/docs/api/orders/v2/
https://developer.paypal.com/docs/api/orders/v2/#orders_capture
https://developer.paypal.com/docs/api/webhooks/v1/#webhooks-events
https://developer.paypal.com/docs/checkout/advanced/3d-secure/
```
