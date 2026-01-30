# Provider Integration Plan (A–F, corrected + operationalized)

> **Last review:** 2026-01-27  
> **Purpose:** Make provider/flow integration scalable and predictable, with strict separation between:  
> (1) **Repo scaffolding**, (2) **Research evidence**, and (3) **Target hardened implementation**.

---

## Scope and assumptions

- This repo currently contains **dummy/scaffold** provider code for Stripe/PayPal (not hardened).
- Real integration learnings live in `providers-research/*-flow-findings.md`.
- Mercado Pago is **NOT FOUND** in code **by design** (implementation was discarded; docs are the evidence).
- Any UI coordination is an **accepted deviation** with a closure plan: move coordination into **application/machine**.

### Definitions (to avoid ambiguity)

- **Command**: event initiated by UI via `PaymentFlowMachineDriver` (e.g., START / CONFIRM / CANCEL / REFRESH).
- **System event**: event initiated by adapters/actors (return/webhook/external updates/fallback). Must have **semantics** in the machine.
- **Confirm**: user expresses intent to proceed (UI command).
- **Finalize**: system executes provider-specific completion step (capture/reconcile/verify/client-confirm orchestration).

---

## A) Current system map (evidence + explicit separation)

### A.1 Layering and ownership

- Architecture rules (north star): `docs/architecture-rules.md`
- Flow brain (operational map): `docs/flow-brain.md`
- Runtime ownership (today):
  - Machine: `src/app/features/payments/application/orchestration/flow/payment-flow.machine.ts`
  - Actor: `src/app/features/payments/application/orchestration/flow/payment-flow.actor.service.ts`
  - Facade: `src/app/features/payments/application/orchestration/flow/payment-flow-machine-driver.ts`
  - Store projection bridge: `src/app/features/payments/application/orchestration/store/projection/payment-store.machine-bridge.ts`

### A.2 External events (current behavior)

- Adapter: `src/app/features/payments/application/adapters/external-event.adapter.ts`
- **Current behavior (as of PR5):**
  - `ExternalEventAdapter` emits **semantic system events only** (no REFRESH): `redirectReturned`, `externalStatusUpdated`, `webhookReceived`.
  - The machine **consumes** `REDIRECT_RETURNED`, `EXTERNAL_STATUS_UPDATED`, and `WEBHOOK_RECEIVED` with real transitions: correlation/dedupe guards, then `finalizing` / `reconcilingInvoke` → terminal.
  - Return page maps query params → referenceId and calls `externalEvents.redirectReturned(...)`; the machine owns finalize/reconcile. The adapter does **not** trigger REFRESH.

**Verification anchors (symbols):**

- `ExternalEventAdapter.redirectReturned`, `.externalStatusUpdated`, `.webhookReceived` → `actor.sendSystem({ type: 'REDIRECT_RETURNED' | 'EXTERNAL_STATUS_UPDATED' | 'WEBHOOK_RECEIVED', payload })`
- Machine `on: { REDIRECT_RETURNED: [...], EXTERNAL_STATUS_UPDATED: [...], WEBHOOK_RECEIVED: [...] }` with guards and transitions to reconciling/finalizing

### A.3 UI coordination (redirect return: closed)

- **Return page (current):** `return.page.ts` maps query params via `mapReturnQueryToReference` and calls `externalEvents.redirectReturned({ providerId, referenceId })`. It does **not** call confirm/capture or REFRESH; the machine handles finalize/reconciling on `REDIRECT_RETURNED`.
- **Remaining coordination anchors (if any):** Checkout: `checkout.page.ts` (redirect URL); Next action: `next-action-card.component.ts/html`; Return mapper: `payment-flow-return.mapper.ts` (provider-agnostic mapping to referenceId).
- **Target:** Provider-agnostic `NextAction.kind` rendering; machine owns `REDIRECT_RETURNED`, `CLIENT_CONFIRM_*`, `FINALIZE_*`, `EXTERNAL_STATUS_UPDATED`, `WEBHOOK_RECEIVED`.

### A.4 Providers (explicit separation)

1. **Code today (dummy/scaffold)**
   - Stripe/PayPal under: `src/app/features/payments/infrastructure/*`
2. **Research evidence (source of truth for integration pain)**
   - `providers-research/stripe-flow-findings.md`
   - `providers-research/paypal-flow-findings.md`
   - `providers-research/mercadopago-flow-findings.md`
3. **Target hardened implementation**
   - Provider-agnostic flow contracts + provider-specific adapters behind ports

### A.5 Mercado Pago

- **NOT FOUND** in repo **on purpose**. Docs are the evidence.
- Do not infer code paths for MP from docs; treat as target to re-implement cleanly after framework hardening.

---

## B) Consolidated friction catalog (12)

> Each item includes: **Impact**, **Fix intent**, and **Closure signal** (how we know it’s solved).

1. **NextAction execution coupling**
   - _Impact:_ provider-specific types + UI branching forces UI edits per provider.
   - _Fix intent:_ public `NextAction.kind` becomes provider-agnostic; execution moves to machine/app.
   - _Closure signal:_ UI does not contain `paypalRequested` / `3ds` / provider branching; only `kind` rendering.

2. **Redirect return + re-entry**
   - _Impact:_ return parsing is provider-specific and UI-owned; re-entry not robust.
   - _Fix intent:_ `REDIRECT_RETURNED` system event + return normalizers per provider; optional context re-hydration.
   - _Closure signal:_ new provider does **not** require edits to Return page logic.

3. **Confirm vs finalize semantics**
   - _Impact:_ one `confirm` use case cannot model capture/reconcile/client-confirm flows.
   - _Fix intent:_ add explicit pipeline: `CLIENT_CONFIRM_*` and `FINALIZE_*` states/events.
   - _Closure signal:_ Stripe 3DS and PayPal capture do not require UI coordination.

4. **ID continuity & correlation**
   - _Impact:_ single `intentId` breaks flows that swap IDs (preference → payment).
   - _Fix intent:_ `providerRefs` map + `externalReference/orderId` correlation in FlowContext.
   - _Closure signal:_ flows support ID swap without replacing “the one ID” in context.

5. **Processing resolution policy** _(verify in machine/policy)_
   - _Impact:_ risk of zombie-state if processing never becomes terminal and policy lacks terminal transition.
   - _Fix intent:_ explicit processing resolution: max duration + max polls + terminal strategy (timeout → failed/needs_manual).
   - _Closure signal:_ after policy bounds, machine transitions to a terminal state with a structured error.

6. **External events have semantics** _(closed in PR1/PR5)_
   - _Was:_ system events were noop; adapter could fall back to REFRESH.
   - _Current:_ machine handles `REDIRECT_RETURNED`, `WEBHOOK_RECEIVED`, `EXTERNAL_STATUS_UPDATED` with real transitions (reconciling/finalizing, dedupe, correlation guards). ExternalEventAdapter emits only these semantic events; no REFRESH.

7. **Config/constraints not enforced centrally**
   - _Impact:_ HTTPS, return URLs, runtime keys, loaders cause production failures.
   - _Fix intent:_ centralized validated provider config (tokens + runtime validation).
   - _Closure signal:_ invalid configs fail fast at startup (or provider registration) with clear errors.

8. **Idempotency + race conditions**
   - _Impact:_ unstable idempotency keys and lack of dedupe cause double finalize/capture/refresh storms.
   - _Fix intent:_ stable idempotency keys derived from `flowId` + operation + attempt; machine guards and event dedupe.
   - _Closure signal:_ duplicate return / double click never triggers duplicate finalize.

9. **Fakes/test ergonomics are not stress-oriented**
   - _Impact:_ cannot reproduce external-event races or webhook-based resolution deterministically.
   - _Fix intent:_ scenario framework: deterministic events + time control + explicit sequences.
   - _Closure signal:_ stress matrix runs locally with deterministic outcomes.

10. **Observability gaps**

- _Impact:_ hard to debug; cannot measure integration friction.
- _Fix intent:_ structured logs/events include `flowId`, `providerId`, `state`, `event`, `referenceIds`.
- _Closure signal:_ every transition and external event is traceable end-to-end by `flowId`.

11. **Return trust / ownership validation**

- _Impact:_ assuming return == approval can cause wrong captures/status queries.
- _Fix intent:_ correlate by `externalReference/orderId` and validate ownership before finalize/status.
- _Closure signal:_ return without valid correlation is rejected or moved to “needs_manual.”

12. **Sensitive data boundaries in persistence**

- _Impact:_ persisting secrets (e.g., client_secret) is a security liability.
- _Fix intent:_ strict allowlist + TTL + redaction; never persist secrets.
- _Closure signal:_ FlowContext persistence stores only safe refs; secrets stay in-memory only.

---

## C) Provider-agnostic design (operational)

### C.1 NextAction public contract (provider-agnostic)

**Public model (UI renders by kind; no provider branching):**

- `kind = redirect` → open URL (PayPal approve, MP init_point, APM redirects)
- `kind = client_confirm` → trigger client confirmation step (e.g., Stripe SDK confirm)
- `kind = manual_step` → show instructions (bank transfer, SPEI)
- `kind = external_wait` → show “processing; awaiting provider”

**Rule:** UI emits a **generic command** (e.g., `PERFORM_NEXT_ACTION`) with an opaque action identifier; application/machine owns execution.

### C.2 System events with semantics (machine-owned)

Minimum required events:

- `REDIRECT_RETURNED`
- `CLIENT_CONFIRM_REQUESTED | CLIENT_CONFIRM_SUCCEEDED | CLIENT_CONFIRM_FAILED`
- `FINALIZE_REQUESTED | FINALIZE_SUCCEEDED | FINALIZE_FAILED`
- `EXTERNAL_STATUS_UPDATED`
- `WEBHOOK_RECEIVED`

**Rule:** If an adapter emits an event, the machine must have semantics for it (no noop).

### C.3 FlowContext + providerRefs + safe persistence

**FlowContext fields (minimum):**

- `flowId` (stable internal id)
- `providerId`
- `externalReference` / `orderId` (correlation)
- `providerRefs: Record<providerId, { intentId?; orderId?; preferenceId?; paymentId?; ... }>`
- `createdAt`, `expiresAt`
- `lastExternalEventId?`, `lastReturnNonce?`
- `returnParamsSanitized?` (minimal)

**Persistence rules**

- Persist **only allowlisted** safe fields.
- TTL: 15–60 minutes (lab default).
- Never persist secrets (`client_secret`, auth tokens), full raw webhook payloads, or PII unless redacted.

### C.4 Mandatory provider contracts (even no-op)

Each provider package must implement these ports (or explicitly no-op them):

- **ReturnNormalizer**
  - Input: query params (+ optional current context)
  - Output: `{ providerId, providerRefs, externalReference, returnNonce, sanitizedParams }`

- **WebhookNormalizer** _(server-side preferred)_
  - Input: provider webhook payload + headers
  - Output: `{ eventId, providerId, providerRefs, status, occurredAt, raw?(redacted) }`

- **ProviderRefResolver**
  - Input: “any reference we have” (intentId/orderId/preferenceId/paymentId)
  - Output: canonical `providerRefs` + recommended query key(s)

### C.5 Finalization pipeline (application-owned)

Create an application-level orchestrator that selects the correct completion steps:

- For redirect providers:
  - return → resolve refs → status verify (and/or finalize)
- For capture providers (PayPal):
  - return/webhook approved → capture → verify
- For client-confirm providers (Stripe 3DS):
  - requires_action → client_confirm → verify

**Machine states (target):**

- `requiresAction` → `clientConfirming` → `finalizing` → `reconciling` → `done|failed|processing`

### C.6 Polling/backoff + processing resolution

Policy must be explicit:

- `maxPollAttempts`
- `maxProcessingDurationMs`
- `retryableErrorPolicy`
- terminal strategy: `processing_timeout` → `needs_manual` or `failed` (domain decision)

### C.7 Anti-race guardrails (machine-level)

- Block `REFRESH` while `clientConfirming/finalizing` unless explicitly allowed.
- Dedupe `REDIRECT_RETURNED` by `returnNonce`.
- Dedupe external events by `eventId`.
- Stable idempotency keys: `flowId + operation + attempt`.

---

## D) Migration plan (incremental PR order + exit criteria)

> **Style:** atomic tasks, branch + commit per step.

### PR1 (P0) — Machine handles external system events _(done)_

- Exit criteria met: machine consumes `REDIRECT_RETURNED/EXTERNAL_STATUS_UPDATED/WEBHOOK_RECEIVED` with transitions; ExternalEventAdapter emits semantic events only (no REFRESH).

### PR2 (P0) — NextAction agnostic + UI renderer generic

- Branch: `task/next-action-generic`
- Commit: `refactor(flow): normalize nextAction kind`
- Exit criteria:
  - UI renders actions only by `NextAction.kind`.
  - No provider-specific action types in UI.
- Rollback strategy:
  - Temporary mapping layer that supports both old and new NextAction shapes.

### PR3 (P0) — FlowContext + providerRefs + safe persistence + re-entry

- Branch: `task/flow-context-reentry`
- Commit: `feat(flow): add providerRefs and safe context store`
- Exit criteria:
  - Context includes `flowId` + `providerRefs` and supports ID swap flows.
  - Persistence allowlist + TTL implemented; secrets never stored.
- Rollback strategy:
  - Persistence can be disabled with feature flag; flow still works in-memory.

### PR4 (P1) — Client confirm + finalization pipeline

- Branch: `task/flow-finalization`
- Commit: `feat(flow): add client confirm and finalize pipeline`
- Exit criteria:
  - Machine has `clientConfirming` and `finalizing` paths.
  - UI does not coordinate client confirm/capture directly.
- Rollback strategy:
  - Allow “legacy confirm” to call current gateways until provider implementations are complete.

### PR5 (P1) — Webhooks normalization + processing resolution policy _(done)_

- Exit criteria met: `WEBHOOK_NORMALIZER_REGISTRY` (Stripe + PayPal) in config; webhook ingestion → `ExternalEventAdapter.webhookReceived`; processing timeout policy and tests (`processing_timeout` → failed).

### PR6 (P2) — Observability + stress fakes/scenarios _(done)_

- Branch: `task/flow-observability`
- Commit: `feat(flow): add flow telemetry and fake scenarios`
- Exit criteria met:
  - Logs/telemetry include `flowId/providerId/state/event/refs`; redaction; InMemory/Console/Noop/Composite sinks.
  - Stress scenario suite (idempotency, dedupe, correlation, terminal safety, processing timeout) runs deterministically. See `docs/observability/flow-telemetry.md`.

---

## E) Test strategy (minimum stress matrix)

> Use **Given / When / Then** phrasing, and label the level (Unit / Integration / E2E).

| Scenario                        | Level            | Given                                                   | When                                           | Then                                                   |
| ------------------------------- | ---------------- | ------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Redirect return success         | Integration      | flow in `requiresAction` with `NextAction.redirect`     | `REDIRECT_RETURNED` with valid refs            | machine transitions to `reconciling` then terminal     |
| Redirect return missing params  | Integration      | return page receives empty/invalid query                | `REDIRECT_RETURNED` with no correlation        | machine sets `failed` or `needs_manual` (policy)       |
| Client confirm success          | Unit+Integration | `NextAction.client_confirm`                             | `CLIENT_CONFIRM_SUCCEEDED`                     | machine proceeds to `reconciling`                      |
| Client confirm cancel/fail      | Unit+Integration | `NextAction.client_confirm`                             | `CLIENT_CONFIRM_FAILED`                        | machine sets structured error and correct terminal     |
| Abandon flow + webhook advances | Integration      | persisted context, UI closed                            | `WEBHOOK_RECEIVED` / `EXTERNAL_STATUS_UPDATED` | status becomes terminal; re-entry loads terminal state |
| Processing timeout              | Unit             | processing state with timers                            | policy exceeds `maxProcessingDurationMs`       | machine transitions terminal with `processing_timeout` |
| ID swap (preference → payment)  | Integration      | context has `preferenceId`, return includes `paymentId` | `REDIRECT_RETURNED` + resolver                 | providerRefs keep both; status uses paymentId          |
| Duplicate return                | Unit             | same `returnNonce` twice                                | `REDIRECT_RETURNED` twice                      | finalize invoked once (dedupe)                         |
| Refresh spam                    | Unit             | user triggers multiple REFRESH                          | multiple `REFRESH` commands                    | machine coalesces/guards; no duplicate finalize        |
| Retry/backoff                   | Unit             | gateway errors retryable/non-retryable                  | status invoke fails                            | retries per policy; stops after max retries            |
| Webhook dedupe                  | Unit             | same `eventId` twice                                    | `WEBHOOK_RECEIVED` twice                       | second ignored                                         |
| Return trust validation         | Integration      | return refs mismatch externalReference                  | `REDIRECT_RETURNED`                            | finalize/status blocked; goes to needs_manual/failed   |

**Notes**

- Keep E2E limited to one “golden path” per action kind. Everything else should be deterministic integration/unit.

---

## F) Definition of Done (integration fluid)

### F.1 Provider integration success metrics

- New provider **does not** require editing Return page logic (provider-agnostic ingestion).
- New provider **does not** require editing Checkout page logic (checkout = start + render).
- 0 provider-specific logic in UI (only `NextAction.kind` rendering).
- Machine has semantics for external events, client confirm, and finalize.
- Observability exists: logs include `flowId/providerId/state/event/referenceIds`.
- Stress matrix (E) passes for the new provider.

### F.2 Provider contract pack (required checklist)

For every new provider package:

- [ ] Factory/registration wired in config
- [ ] Strategy validates minimum required fields
- [ ] ReturnNormalizer implemented (or explicit no-op)
- [ ] WebhookNormalizer implemented (or explicit no-op; server-side preferred)
- [ ] ProviderRefResolver implemented
- [ ] NextAction mapping uses only `kind` (redirect/client_confirm/manual_step/external_wait)
- [ ] Idempotency keys derived from `flowId + operation + attempt`
- [ ] Required stress scenarios pass (E)

### F.3 Production readiness minimums (even for lab)

- HTTPS return/notification URLs validated (fail fast).
- Webhook signature verification lives in backend (preferred); if absent, explicit gap documented.
- Idempotency + dedupe in finalize/capture/status actions.
- Sensitive data persistence rules enforced (allowlist + TTL + redaction).

---

## Appendix: “What to verify in repo” quick checklist

- [x] Do system events have semantics in machine `on` handlers? (yes: REDIRECT_RETURNED / EXTERNAL_STATUS_UPDATED / WEBHOOK_RECEIVED → reconciling/finalizing)
- [x] Does adapter emit only semantic events (no REFRESH)? (yes)
- [x] Does policy define terminal transition after max polls / max duration? (yes: processing_timeout)
- [ ] Are there any provider-specific branches in UI components for actions?
- [ ] Is return parsing provider-agnostic (query → referenceId → redirectReturned)?
