# Flow Telemetry (PR6)

> Structured observability for the payment flow: flowId, providerId, state, event, refs; redaction rules; sinks.

## Event envelope

Every flow telemetry event includes:

- **flowId** — stable internal flow id (when available from context).
- **providerId** — current provider (when available).
- **refs** — correlation references (e.g. `intentId`, `referenceId`, `eventId`); never raw PII or secrets.
- **type** — event kind: `COMMAND_SENT`, `SYSTEM_EVENT_SENT`, `STATE_CHANGED`, `EFFECT_START`, `EFFECT_FINISH`, `ERROR_RAISED`.
- **state/tag** — for `STATE_CHANGED`: machine state and tags.
- **timestamp** — `atMs` (milliseconds since epoch).
- **meta** — optional safe key-value (no secrets).

## Redaction rules

- **Never log secrets:** `client_secret`, auth tokens, and similar are redacted (e.g. `[redacted]`) before any sink.
- **Never log raw PII:** Only allowlisted correlation ids (flowId, intentId, referenceId, eventId) appear in events.
- **Intent/snapshot:** `clientSecret`, `nextAction.token`, and `raw` are stripped or redacted in logs and telemetry.

## Sinks

- **InMemory** — bounded buffer (e.g. 500 events); used in tests and for in-process inspection.
- **Console** — logs to `console.log` with redacted payloads; dev only.
- **Noop** — discards events; default in production unless another sink is configured.
- **Composite** — forwards to multiple sinks (e.g. InMemory + Console in dev).

## Instrumentation points

- **COMMAND_SENT** — when the actor sends a command (START, RESET, REFRESH, etc.).
- **SYSTEM_EVENT_SENT** — when a system event is sent (REDIRECT*RETURNED, WEBHOOK_RECEIVED, EXTERNAL_STATUS_UPDATED, FALLBACK*\*).
- **STATE_CHANGED** — on every machine state transition (with dedupe of identical state in InMemory).
- **EFFECT_START** — when entering an effect state (e.g. `starting`, `fetchingStatusInvoke`, `reconcilingInvoke`, `finalizing`, `clientConfirming`).
- **EFFECT_FINISH** — when leaving an effect state.
- **ERROR_RAISED** — when the flow context error is set (e.g. `processing_timeout`, `return_correlation_mismatch`).

## Configuration

- **FLOW_TELEMETRY_SINK** — Angular injection token; provide a `FlowTelemetrySink` implementation (default: `NoopFlowTelemetrySink`).
- Tests use `InMemoryFlowTelemetrySink` via the scenario harness to assert on events (providerId, refs, no duplicate side-effects).
