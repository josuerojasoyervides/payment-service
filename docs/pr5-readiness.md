# PR5 Readiness Summary

## 1. PR5 Scope

- **Webhook normalization:** External signals (`WEBHOOK_RECEIVED`, `EXTERNAL_STATUS_UPDATED`) must emit semantic system events that the machine handles directly. No more forcing a `REFRESH` after every adapter call; the machine should move to `reconciling`/`finalizing`/terminal states based on the event data.
- **Processing resolution policy:** Define and enforce guards for `maxPollAttempts`, `maxProcessingDurationMs`, retryable errors, and desired terminal transitions (e.g., `processing_timeout` → `failed` or `needs_manual`). Polling remains a fallback path but should sit behind these explicit limits and produce a structured `PaymentError` when triggered.

## 2. Provider-specific evidence

- **Stripe:** The existing flow depends on polling after the UI invokes the Stripe.js adapter; there are no webhooks and no machine semantics for delayed updates. Official docs require listening to `payment_intent.succeeded`/`payment_intent.payment_failed` for deferred methods, so PR5 must add a webhook adapter that emits events tied to `flowId`/`providerRefs` and tests that flows only resolve when the webhook arrives (even if the UI is closed).
- **PayPal:** Approval → capture is handled on the Return page, not in the machine, and PayPal provides `CHECKOUT.ORDER.APPROVED` / `PAYMENT.CAPTURE.COMPLETED` webhooks. PR5 should move capture orchestration into application logic, normalize the webhook events, and add retry/backoff plus processing termination so that capture races and processing timeouts have deterministic results.
- **Mercado Pago:** The preference-to-payment ID swap shows the need for a normalized webhook pipeline and processing policy—the flow currently stays in `processing` for `pending`/`in_process`/`authorized` statuses, and there is no webhook or timeout guard. This document should serve as the strongest evidence that webhook + processing rules are required before adding additional providers.

## 3. PR5 Test Checklist

- **Semantic external events:** Verify the flow machine reacts meaningfully to `WEBHOOK_RECEIVED` / `EXTERNAL_STATUS_UPDATED` without falling back to `REFRESH` (include scenarios where only the webhook completes a flow while the UI is closed). Ensure adapters stop issuing implicit `REFRESH` commands after emitting their system event.
- **Deduplication & idempotency:** Tests must show webhooks/returns with duplicate `eventId`/`returnNonce` are ignored, and confirm idempotency keys are built from `flowId + operation + attempt` so double finalize/capture attempts are coalesced.
- **Processing resolution policy:** Simulate long-running `processing` states that exceed `maxPollAttempts` or `maxProcessingDurationMs`, and assert the machine transitions to a terminal state (`failed` or `needs_manual`) with a `PaymentError` whose code describes the policy breach (e.g., `processing_timeout`).
- **Webhook vs REFRESH path:** Confirm the primary update path is webhook events, not `REFRESH`; if a webhook is available, the test should pass even when the UI never issues a refresh.
- **Flow correlation & persistence safety:** Ensure external events carry `flowId`/`providerRefs`, and that correlation failures lead to rejection or `needs_manual` while respecting the FlowContext persistence allowlist and secret-redaction rules.

## 4. Human checklist before coding PR5

- Confirm domain/application/infrastructure layers remain decoupled (application defines the webhook ports, infrastructure implements them, UI only triggers commands). Use `docs/provider-integration-plan.md`, `docs/flow-brain.md`, and architecture rules as references.
- Reference the provider research files (`docs/providers-research/stripe-flow-findings.md`, `paypal-flow-findings.md`, `mercadopago-flow-findings.md`) as evidence for webhook/processing gaps to justify each new change.
- Keep the existing polling path configurable/fallback-only so a rollback can be applied quickly if webhook normalization introduces instability; the policy should not break the ability to fall back to a simple refresh-based flow temporarily.

## 5. Test run snapshot

- Command: `npm run test:ci` (`ng test --configuration ci`).
- Duration: ~5.4s (build ~2.1s + tests ~3s). All suites execute successfully, but the runner fails before completion because Vitest/Vite cannot kill its worker processes in this sandbox (`Error: kill EPERM` / `EPERM: operation not permitted, mkdir ...`). Expect clean results on a normal machine; rerun locally if the sandbox continues to block process termination.
