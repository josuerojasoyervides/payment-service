# PR6 — Resilience / stress suite

How to run and interpret the payment flow stress tests (PR6 Phase C/D).

## How to run

```bash
bun run test:ci
```

Or run only the stress/mega specs (Vitest):

```bash
bun run test:ci -- --testPathPattern="stress|mega-chaos"
```

(Exact pattern depends on your test runner; the specs live under `application/orchestration/testing/`.)

## Invariants covered

- **Finalize idempotency:** REDIRECT_RETURNED + WEBHOOK_RECEIVED (including duplicates) → `requestFinalize` called exactly once; flow converges to done/ready.
- **Correlation mismatch:** WEBHOOK_RECEIVED with a different `referenceId` than the current flow → event ignored; state unchanged for current intent; no finalize triggered.
- **Convergence:** Flow does not end in `failed` when duplicates/delays/out-of-order events are applied; telemetry timeline is consistent.
- **No secrets in telemetry:** Payloads are sanitized (allowlist); no `raw`, `clientSecret`, `token`, `email`, `headers`, `authorization` in any event payload.

## Telemetry events (Phase B list)

Events emitted by the flow (observability sink):

| Type                  | When                                                           |
| --------------------- | -------------------------------------------------------------- |
| FLOW_STARTED          | START command sent                                             |
| COMMAND_RECEIVED      | START or REFRESH command sent                                  |
| SYSTEM_EVENT_RECEIVED | REDIRECT_RETURNED or WEBHOOK_RECEIVED sent (payload sanitized) |
| POLL_ATTEMPTED        | Polling state, each attempt                                    |
| FLOW_SUCCEEDED        | State transitions to done                                      |
| FLOW_FAILED           | State transitions to failed                                    |

**Interpreting the timeline:** Use `InMemoryTelemetrySink` in tests; assert `telemetry.ofType('SYSTEM_EVENT_RECEIVED')`, `telemetry.last('FLOW_SUCCEEDED')`, etc. Payload is always allowlisted (e.g. `providerId`, `referenceId`, `eventId`, `status`, `code`, `messageKey`); never log raw or secrets.

## Payload sanitization

Telemetry payloads are passed through `sanitizeTelemetryPayloadForSink` (or built allowlisted). Allowed keys: `providerId`, `referenceId`, `eventId`, `returnNonce`, `operation`, `attempt`, `reason`, `status`, `code`, `messageKey`. Forbidden: `raw`, `headers`, `clientSecret`, `token`, `email`, `authorization`, `request`, `response`.
