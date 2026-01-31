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
- **No secrets in telemetry:** New envelope uses `refs`/`meta` only; no `raw`, `clientSecret`, `token`, `email`, `headers`, `authorization` in any event.

## Telemetry events (FLOW_TELEMETRY_SINK)

Events emitted by the flow (new envelope: `kind`, `eventType`, `refs`, `meta`; no raw payloads):

| Kind              | When                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| COMMAND_SENT      | START or REFRESH command sent (`eventType` === 'START'/'REFRESH')                               |
| SYSTEM_EVENT_SENT | REDIRECT_RETURNED or WEBHOOK_RECEIVED sent; correlation via `refs.referenceId` / `refs.eventId` |
| STATE_CHANGED     | Machine state transition (state, tags, errorCode, status)                                       |
| EFFECT_START      | Effect state entered (e.g. starting, fetchingStatusInvoke)                                      |
| EFFECT_FINISH     | Effect state left                                                                               |
| ERROR_RAISED      | Error code set on context                                                                       |

**Interpreting the timeline:** Use `InMemoryFlowTelemetrySink` in tests: `telemetry.ofKind(...)`, `telemetry.lastKind(...)`, `telemetry.getEvents()`, `telemetry.count(...)`. Correlation is via `event.refs?.referenceId` and `event.refs?.eventId`; no secrets by design (refs/meta only).

## No secrets in telemetry

The new telemetry envelope does not carry raw payloads: only `refs` (allowlisted correlation: referenceId, eventId, etc.) and optional `meta`. Secrets (clientSecret, token, email, authorization, etc.) are never recorded.

## Evidence checks (report hygiene)

When generating or verifying reports:

- **Chaos fakes:** Grep for `scheduleDelayedWebhook|createFlakyStatusUseCaseFake` (these are the actual helper/fake names in code), not `DelayedWebhookFake|FlakyStatus`.
- **Resilience suite doc:** The string `pr6-resilience-suite` appears in the filename, not in the file body. Use `ls docs | grep pr6-resilience-suite` or grep a heading inside the doc (e.g. `Resilience / stress suite` or `Invariants covered`).
