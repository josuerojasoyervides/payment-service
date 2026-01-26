# Flow Scalability Plan (Temporary)

> **Status:** active
> **Created:** 2026-01-26
> **Removal rule:** delete this file once Step 1 is completed and merged.

## Purpose

This document captures the temporary plan for scaling the payments flow architecture. It is intentionally short-lived and should be removed once Step 1 is done.

## Global Checklist (Stage-Based, No CRUD)

### Step 1 — Reduce complexity by segmentation (feature) ✅

- **1.1 Flow: core + stage submachines** ✅
  - Split the flow into a minimal `core.machine` plus stage machines (authorize/confirm/polling/etc).
- **1.2 Orchestration: policy vs runtime** ✅
  - Separate pure decision policies from runtime side-effects (timers, retries, scheduling).
- **1.3 Store: slices by responsibility** ✅
  - Split store into `projection`, `history`, and `fallback` modules.
- **1.4 Guards delegate to policies** ✅
  - Guards only route; rules live in policies.
- **1.5 External event mappers** ✅
  - Map backend/webhook inputs into normalized internal events before the flow consumes them.

### Step 2 — Stage-based event contract

- Public commands vs internal/system events.
- Stage semantics: INITIATE / AUTHORIZE / REQUIRES_ACTION / CAPTURE / SETTLE / FAIL / CANCEL.

### Step 3 — Provider/method policies

- Validation, eligibility, and transition rules per provider/method.

### Step 4 — Contract tests

- Transition tests per state/event, including invalid events.

### Step 5 — Docs refresh

- Update flow brain and active context, then remove this plan file.

## Step 1 Execution Notes

- This step is structural only; no behavior changes.
- Keep imports stable via index barrels where needed.
- Each substep should be atomic and reviewable.

## Status

Step 1 completed (1.1–1.5). Remove this file once Step 1 is merged.
