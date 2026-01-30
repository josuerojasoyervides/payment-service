# Mercado Pago Flow Findings (Implementation Stress Report)

> Date: 2026-01-27
> Scope: Mercado Pago Checkout Pro redirect flow (preference create -> approve redirect -> payment status refresh)

## 1) What was implemented

### 1.1 Mercado Pago flow (current behavior)

- UI builds a `CreatePaymentRequest` using the MercadoPagoRedirectRequestBuilder.
- Strategy validates currency/amount and requires `returnUrl` from StrategyContext.
- Gateway creates a Checkout Pro preference (`/checkout/preferences`) with `back_urls`, `auto_return`, and `notification_url` (if provided).
- Intent is enriched with `nextAction.type = redirect` and `redirectUrl = init_point`.
- After user approval and return, the Return page triggers a refresh using `payment_id` (or `collection_id`).
- Refresh uses `GET /v1/payments/{id}` to map final status to our PaymentIntent.

### 1.2 End-to-end sequence (explicit)

1. `CheckoutComponent` builds request -> `PaymentFlowMachineDriver.start('mercadopago', req, context)`.
2. `MercadoPagoRedirectStrategy.start()` calls create preference gateway.
3. `MercadoPagoCreateIntentGateway` sends preference payload with `back_urls`, `auto_return=approved`, `external_reference=orderId`, optional `payer.email`.
4. Response maps to a `PaymentIntent` in `requires_action` with `redirectUrl=init_point`.
5. UI shows `NextActionCard` for redirects (button -> navigate to `init_point`).
6. On return, `/payments/return` reads `payment_id` or `collection_id`, then calls `flow.refresh('mercadopago', paymentId)`.
7. `MercadoPagoGetIntentGateway` queries `/v1/payments/{payment_id}` and maps to `PaymentIntentStatus`.

### 1.3 ASCII sequence diagram (happy path)

```
User        UI/Checkout     FlowFacade      Strategy        MP Gateway        Mercado Pago
 |              |               |              |                |                 |
 | Click Pay    |               |              |                |                 |
 |------------->| start()       |              |                |                 |
 |              |-------------->| START        |                |                 |
 |              |               |------------->| create pref    |                 |
 |              |               |              |--------------->| POST /preferences
 |              |               |              |                |--------------->|
 |              |               |              |                |<---------------|
 |              |               |              | maps init_point|                 |
 |              |  nextAction   |              |                |                 |
 |              |<--------------|              |                |                 |
 | Redirect     |               |              |                |                 |
 |------------->| open init_point               |                |                 |
 |   approve on Mercado Pago                   |                |                 |
 |<------------------------------------------- return (payment_id)                |
 |              | refresh(payment_id)          |                |                 |
 |              |-------------->| REFRESH      |                |                 |
 |              |               |--------------| get status     |                 |
 |              |               |              |--------------->| GET /v1/payments/{id}
 |              |               |              |                |--------------->|
 |              |               |              |                |<---------------|
 |              |               |              | map status     |                 |
 |              |  succeeded    |              |                |                 |
 |              |<--------------|              |                |                 |
```

- Key notes:
  - Preference ID is returned first; payment ID is returned on redirect.
  - Flow switches the intentId on refresh after return.

### 1.4 Files touched / core ownership

- Provider factory + strategy: `src/app/features/payments/infrastructure/mercadopago/factories/mercadopago-provider.factory.ts`,
  `src/app/features/payments/infrastructure/mercadopago/strategies/mercadopago-redirect.strategy.ts`
- Gateways + DTOs + mappers: `src/app/features/payments/infrastructure/mercadopago/gateways/intent/*.gateway.ts`,
  `src/app/features/payments/infrastructure/mercadopago/dto/mercadopago.dto.ts`,
  `src/app/features/payments/infrastructure/mercadopago/mappers/*.ts`
- Fake gateways and helpers: `src/app/features/payments/infrastructure/mercadopago/fake-gateways/intent/*.ts`,
  `src/app/features/payments/infrastructure/fake/helpers/*mercadopago*.ts`
- UI return mapping: `src/app/features/payments/ui/pages/return/return.page.ts`
- Config wiring: `src/app/features/payments/config/payment.providers.ts`
- Integration tests: `src/app/features/payments/ui/pages/checkout/checkout.page.integration.spec.ts`

### 1.5 Data contracts and mapping (key fields)

**Preference request (Checkout Pro)**:

- `items[0].title`, `unit_price`, `currency_id`, `quantity`
- `back_urls.success|pending|failure`
- `auto_return = 'approved'`
- `external_reference = orderId`
- `payer.email` (optional)
- `notification_url` (optional, reserved for webhooks)

**Preference response (partial)**:

- `id`
- `init_point` (redirect URL)
- `sandbox_init_point` (if sandbox)

**Payment response (partial)**:

- `id`
- `status` (`approved`, `pending`, `in_process`, `rejected`, `cancelled`, `refunded`, `charged_back`, `authorized`)
- `transaction_amount`, `currency_id`

**Status mapping (Mercado Pago -> PaymentIntentStatus)**:

- `approved` -> `succeeded`
- `pending`, `in_process`, `authorized` -> `processing`
- `rejected`, `refunded`, `charged_back` -> `failed`
- `cancelled` -> `canceled`

### 1.6 UI and user actions

- `nextAction.type = 'redirect'` triggers a generic redirect card (no provider-specific UI).
- Return page supports `payment_id` and `collection_id` and refreshes automatically unless cancel flow is active.

### 1.7 Fake flow behavior (deterministic)

- **Create preference**: returns a fake `PREF_*` with `init_point` + `sandbox_init_point`.
- **Confirm**: returns `approved` payment (simulated).
- **Get status**:
  - if payment ID contains `approved`/`success` -> `approved`
  - if payment ID contains `canceled`/`cancelled` -> `cancelled`
  - otherwise -> `pending`
- **Cancel**: returns `cancelled` payment (fake only).

### 1.8 Concrete payload examples

**Create preference request (Checkout Pro)**:

```json
{
  "items": [
    {
      "title": "Order order_123",
      "quantity": 1,
      "unit_price": 499.99,
      "currency_id": "MXN",
      "description": "Order order_123"
    }
  ],
  "back_urls": {
    "success": "https://example.com/payments/return",
    "pending": "https://example.com/payments/return",
    "failure": "https://example.com/payments/cancel"
  },
  "auto_return": "approved",
  "external_reference": "order_123",
  "payer": { "email": "buyer@example.com" },
  "notification_url": "https://api.example.com/webhooks/mercadopago"
}
```

**Preference response (partial)**:

```json
{
  "id": "PREF_ABC123",
  "init_point": "https://www.mercadopago.com/checkout/v1/redirect?pref_id=PREF_ABC123",
  "sandbox_init_point": "https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=PREF_ABC123"
}
```

**Payment status response (partial)**:

```json
{
  "id": 987654321,
  "status": "approved",
  "status_detail": "accredited",
  "transaction_amount": 499.99,
  "currency_id": "MXN",
  "external_reference": "order_123"
}
```

## 2) Complexity assessment (what was hard)

### 2.1 Preference ID vs Payment ID mismatch

- The first step returns a Preference ID, but final status is tied to a Payment ID.
- The flow machine assumes a single `intentId`; switching IDs requires a refresh from an external return.

### 2.2 Redirect approval is external

- Approval happens on Mercado Pago, not in our UI.
- The only signal to proceed is the return URL or a webhook.

### 2.3 What was smooth / strong points (architecture wins)

- Provider registration is clean: factory + policy + gateways slotted in without changing core orchestration.
- `nextAction.type = redirect` works well for Checkout Pro with minimal UI changes.
- Fake gateway wiring allowed deterministic flows (`requires_action` -> refresh -> succeeded) quickly.
- Shared mappers and `PaymentIntent` contract reduced provider-specific divergence.

## 3) Hacks / compromises (explicit)

1. **Confirm step is implemented as GET payment**
   - Checkout Pro does not require a capture call, so `confirm` is mapped to status refresh.

2. **Return flow swaps IDs implicitly**
   - We refresh using `payment_id`/`collection_id`, which replaces the previous Preference ID in context.

3. **No webhook adapter**
   - We rely on refresh/polling, which is not enough for delayed or asynchronous final states.

## 4) Gaps and risks

- **Webhook handling missing**: Checkout Pro recommends webhooks for reliable final status and delayed states.
- **Return URL constraints**: back_urls and notification_url require HTTPS (HTTP is blocked by API validation after March 29, 2025).
- **Pending and in_process statuses**: need polling/backoff and a terminal resolution policy.
- **Preference vs payment reconciliation**: no model for linking preference_id to payment_id beyond return params.
- **Cancel support**: cancel is not supported in the real gateway (only simulated in fake).
- **Fraud/risk updates**: status_detail is not captured or surfaced in UI for troubleshooting.
- **No signature verification**: webhook security is not implemented.

## 4.1 What would break in production right now

- If the buyer never returns, we cannot advance state without a webhook.
- If `notification_url` is missing/misconfigured, delayed methods will appear “stuck” in processing.
- If return URLs are HTTP (non-HTTPS), preference creation will be rejected by the API.

## 5) Architectural pressure points

### 5.1 External approval should be a first-class flow event

- Redirect-based providers need a system event like APPROVED or REDIRECT_RETURNED to switch IDs and continue.

### 5.2 Webhooks belong in the application layer

- The flow should accept webhook updates and reconcile them into status transitions without UI intervention.

## 6) Recommendations (short-term)

1. Add a `REDIRECT_RETURNED` event that accepts `referenceId` and updates flow context.
2. Add webhook adapter for `payment` topic and map to `ExternalEventAdapter`.
3. Add a reconciliation step that links preference_id -> payment_id for audit/history.
4. Add retry/backoff policy for `pending`/`in_process` states.
5. Capture `status_detail` to improve error messages and support diagnostics.
6. Add a minimal webhook signature validation (header + secret) in infrastructure.

## 7) Test matrix (states vs expected UI/flow behavior)

| Provider status (MP) | Mapped PaymentIntentStatus | NextAction | UI expected behavior | Flow action     |
| -------------------- | -------------------------- | ---------- | -------------------- | --------------- |
| approved             | succeeded                  | none       | Show success         | done            |
| pending              | processing                 | none       | Show processing      | allow refresh   |
| in_process           | processing                 | none       | Show processing      | allow refresh   |
| authorized           | processing                 | none       | Show processing      | allow refresh   |
| rejected             | failed                     | none       | Show error           | done            |
| cancelled            | canceled                   | none       | Show canceled        | done            |
| refunded             | failed                     | none       | Show error           | done            |
| charged_back         | failed                     | none       | Show error           | done            |
| preference created   | requires_action            | redirect   | Show redirect CTA    | wait for return |

## 8) Diff vs Stripe/PayPal (comparison)

| Dimension          | Stripe                            | PayPal                 | Mercado Pago                    |
| ------------------ | --------------------------------- | ---------------------- | ------------------------------- |
| Primary object     | PaymentIntent                     | Order                  | Preference -> Payment           |
| Client confirm     | Yes (3DS, Stripe.js)              | No (redirect approval) | No (redirect approval)          |
| Confirm call       | `confirm` (server or client)      | `capture`              | Not required (GET status)       |
| Redirect step      | Optional (3DS or redirect PMs)    | Required (approve URL) | Required (Checkout Pro)         |
| Return params      | `payment_intent` / `setup_intent` | `token` (+ `PayerID`)  | `payment_id` or `collection_id` |
| Webhooks critical? | Yes (delayed methods)             | Yes                    | Yes                             |
| ID continuity      | Stable (PI)                       | Stable (order)         | Changes (preference -> payment) |
| UI special case    | 3DS card action                   | Approve + capture      | Generic redirect                |

## 9) Webhook payload example + signature expectations

**Incoming webhook (payment topic, partial)**:

```json
{
  "id": 987654321,
  "live_mode": true,
  "type": "payment",
  "date_created": "2026-01-27T00:00:00.000-04:00",
  "data": {
    "id": "987654321"
  },
  "action": "payment.updated"
}
```

**Server-side verification (expected)**:

- Validate signature header (provider-specific) against configured webhook secret.
- Fetch full payment by `data.id` and map to `PaymentIntent`.
- Emit `ExternalEventAdapter.webhookReceived(...)` with `referenceId = payment_id`.

**Why it matters**:

- Webhook is the only reliable signal when buyers don’t return or status transitions are delayed.

## 10) Failure-path ASCII diagram (reject/cancel/pending)

```
User        UI/Checkout     FlowFacade      Strategy        MP Gateway        Mercado Pago
 |              |               |              |                |                 |
 | Pay          |               |              |                |                 |
 |------------->| start()       |              |                |                 |
 |              |-------------->| START        |                |                 |
 |              |               |------------->| create pref    |                 |
 |              |               |              |--------------->| POST /preferences
 |              |               |              |                |--------------->|
 |              |               |              |                |<---------------|
 |              |<--------------|  requires_action (redirect)   |                 |
 | Redirect     |               |              |                |                 |
 |------------->| open init_point               |                |                 |
 |   user cancels / payment rejected / pending                   |                 |
 |<------------------------------------------- return (payment_id)                |
 |              | refresh(payment_id)          |                |                 |
 |              |-------------->| REFRESH      |                |                 |
 |              |               |--------------| get status     |                 |
 |              |               |              |--------------->| GET /v1/payments/{id}
 |              |               |              |                |--------------->|
 |              |               |              |                |<---------------|
 |              |               |              | map status     |                 |
 |              |  failed/canceled/processing  |                |                 |
 |              |<--------------|              |                |                 |
```

## 11) XState transition table (provider-specific flow)

| Current flow state | Event         | Guard (key)                     | Next state     | Notes                       |
| ------------------ | ------------- | ------------------------------- | -------------- | --------------------------- |
| idle               | START         | valid provider + request        | loading        | create preference           |
| loading            | DONE (create) | intent.status = requires_action | requiresAction | NextAction redirect         |
| requiresAction     | REFRESH       | providerId + intentId           | loading        | uses payment_id from return |
| loading            | DONE (get)    | status = succeeded              | done           | success                     |
| loading            | DONE (get)    | status = failed                 | error          | failure                     |
| loading            | DONE (get)    | status = canceled               | canceled       | cancel                      |
| loading            | DONE (get)    | status = processing             | processing     | show processing             |

## 12) Production readiness checklist

- HTTPS-only return URLs and notification URLs.
- Webhook endpoint with signature verification and idempotency.
- Storage for preference_id -> payment_id reconciliation.
- Retry/backoff for `pending` / `in_process` status.
- Observability: log correlation IDs across preference, payment, webhook.
- Error mapping using `status_detail` and `cause`.
- Return flow: handle missing `payment_id` gracefully (fallback to polling or error).

---

# Mercado Pago Official Docs: Complex Flows and Potential Issues

## A) Checkout Pro preference + return URLs

**Docs points**:

- A Checkout Pro integration requires creating a payment preference.
- Return URLs are configured via `back_urls` and used for success/failure/pending flows.
- `auto_return` controls automatic redirection after approval.

**Risks for our architecture**:

- Return URLs must be provided in the strategy context and stored in metadata.
- HTTP URLs are rejected; only HTTPS should be accepted.

## B) Payments API for final status

**Docs points**:

- Payment status can be queried via `GET /v1/payments/{payment_id}`.

**Risks for our architecture**:

- We need a consistent mapping for Mercado Pago status -> PaymentIntentStatus.
- A webhook is still required to avoid relying solely on polling.

## C) Webhooks

**Docs points**:

- Webhooks can be configured for `payment` events and deliver updates via HTTP POST.

**Risks for our architecture**:

- We lack signature validation and webhook ingestion in the infrastructure layer.

---

# Sources (official Mercado Pago docs)

```
https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/create-payment-preference
https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/configure-back-urls
https://www.mercadopago.com.mx/developers/en/reference/preferences/_checkout_preferences_id/get
https://www.mercadopago.com.mx/developers/en/docs/subscriptions/additional-content/payment-management
https://www.mercadopago.com.mx/developers/en/docs/your-integrations/notifications/webhooks
https://www.mercadopago.com.mx/developers/en/news/2024/11/14/We-have-updated-the-Preference-API
```
