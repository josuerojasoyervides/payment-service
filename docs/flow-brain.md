# Flow Brain — Payments State Machine (XState)

> **Last review:** 2026-02-01
> This document is the operational map of the payments flow. It explains **why** a state is entered and **who** triggers it.

---

## Layers and responsibilities

- **UI / Facade**: sends only public commands (`START`, `CONFIRM`, `CANCEL`, `REFRESH`, `RESET`).
- **ActorService**: runs the machine and dispatches **system** events (`FALLBACK_*`).
- **ExternalEventAdapter**: normalizes external inputs (webhooks/returns) into system events.
- **Machine (XState)**: owns flow logic, retries, polling cadence, and state transitions.
- **Fallback Orchestrator**: decides fallback policy and emits fallback events.
- **Store**: projection only (snapshot + fallback + history), no orchestration.

---

## State diagram (ASCII)

```
UI (Facade)
  START / CONFIRM / CANCEL / REFRESH / RESET
          │
          ▼
ActorService
  send(command) ─────────────┐
  sendSystem(fallback) ───┐  │
                          │  ▼
Machine (XState)          │  idle
  starting <──────────────┘   │
   ├─ done(start) → afterStart
   └─ error(start) → failed
                         │
afterStart ──────────────┼─ needsUserAction → requiresAction
                         ├─ isFinal → done
                         └─ else → polling
                                         │
polling ──(after pollDelay)───────────────┘
   └─ REFRESH → fetchingStatus → fetchingStatusInvoke
                                 ├─ done(status) → afterStatus
                                 └─ error(status) → statusRetrying → fetchingStatus

failed ──(fallback eligible)──────────────▶ fallbackCandidate
failed ──REFRESH─────────────────────────▶ fetchingStatus
failed ──RESET───────────────────────────▶ idle

fallbackCandidate
  ├─ FALLBACK_EXECUTE → starting
  └─ FALLBACK_ABORT → done

Orchestrator (Fallback)
  reportFailure ← ActorService (on machine error)
  emits:
    - fallbackAvailable$ (manual)
    - fallbackExecute$ (auto)
  → ActorService.sendSystem(FALLBACK_*)

ExternalEventAdapter
  maps returns/webhooks → system events
  → ActorService.sendSystem(PROVIDER_UPDATE/WEBHOOK_RECEIVED/STATUS_CONFIRMED)

Store (projection)
  machine snapshot → loading/ready/error/history
  fallback state → pending/auto_executing
```

---

## State → event → origin (quick debug map)

```
System events (external inputs)
- PROVIDER_UPDATE (ExternalEventAdapter)
- WEBHOOK_RECEIVED (ExternalEventAdapter)
- VALIDATION_FAILED (ExternalEventAdapter)
- STATUS_CONFIRMED (ExternalEventAdapter)

idle
- START (UI → PaymentFlowMachineDriver.start)
- CONFIRM (UI → PaymentFlowMachineDriver.confirm)
- CANCEL (UI → PaymentFlowMachineDriver.cancel)
- REFRESH (UI → PaymentFlowMachineDriver.refresh)

starting
- done(start) (machine invoke)
- error(start) (machine invoke)

afterStart
- auto decision (machine guards)

requiresAction
- CONFIRM (UI)
- CANCEL (UI)
- REFRESH (UI)

confirming
- done(confirm) (machine invoke)
- error(confirm) (machine invoke)

afterConfirm
- auto decision (machine guards)

polling
- after pollDelay (machine timer)
- REFRESH (UI)
- CANCEL (UI)

fetchingStatus
- immediate guard check (machine)

fetchingStatusInvoke
- done(status) (machine invoke)
- error(status) (machine invoke)

statusRetrying
- after statusRetryDelay (machine timer)

afterStatus
- auto decision (machine guards)

failed
- FALLBACK_REQUESTED (ActorService → internal)
- PROVIDER_UPDATE / WEBHOOK_RECEIVED (ExternalEventAdapter → internal)
- REFRESH (UI)
- RESET (UI)

fallbackCandidate
- FALLBACK_EXECUTE (ActorService/orchestrator or UI accept)
- FALLBACK_ABORT (ActorService/store)

done
- RESET (UI)
- REFRESH (UI)
```

---

## Key behaviors (why a state happens)

### 1) START

- **Trigger:** UI sends `START`
- **State:** `idle → starting`
- **Result:** `afterStart` or `failed`

### 2) afterStart → requiresAction / done / polling

- **requiresAction** if intent needs user action (`requires_action` or has `nextAction/redirectUrl`).
- **done** if intent is final (`succeeded`, `failed`, `canceled`).
- **polling** otherwise.

### 3) polling cadence

- Each time `polling` runs, it increments `polling.attempt`.
- After `pollDelay` it triggers a `fetchingStatus` cycle.
- Stops when `maxAttempts` is reached or flow ends.

### 4) status retry (backoff)

- If `getStatus` fails, the machine enters `statusRetrying`.
- After `statusRetryDelay`, it retries `fetchingStatus`.
- If `maxRetries` reached, it goes to `failed`.

### 5) fallback

- On machine error, ActorService calls `FallbackOrchestrator.reportFailure`.
- If eligible, ActorService sends `FALLBACK_REQUESTED`.
- `fallbackCandidate` waits for manual or auto fallback.
- `FALLBACK_EXECUTE` restarts the flow with the new provider.

---

## Where to look in code

- Machine: `src/app/features/payments/application/orchestration/flow/payment-flow.machine.ts`
- Policy + config: `src/app/features/payments/application/orchestration/flow/payment-flow/policy/payment-flow.policy.ts`
- Actor host: `src/app/features/payments/application/orchestration/flow/payment-flow.actor.service.ts`
- Actor helpers (pipeline/telemetry/persistence/fallback/inspection): `src/app/features/payments/application/orchestration/flow/actor/`
- Facade: `src/app/features/payments/application/orchestration/flow/payment-flow-machine-driver.ts`
- External events: `src/app/features/payments/application/adapters/external-event.adapter.ts`
- Event map: `src/app/features/payments/application/adapters/events/payment-flow.events.ts`
- Fallback: `src/app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service.ts`
- Store bridge: `src/app/features/payments/application/orchestration/store/projection/payment-store.machine-bridge.ts`
- Contract tests: `src/app/features/payments/tests/payment-flow.contract.spec.ts`

---

## TL;DR

- XState is the flow brain.
- UI only sends public commands.
- ActorService injects system/fallback events.
- Fallback orchestrator decides if/when a provider switch happens.
- Store is projection only.
