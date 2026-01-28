# 🧠 Active Context & Session State

> **SURVIVAL INSTRUCTIONS (CROSS-SESSION CONTINUITY):**
>
> 1. **Primary Mission:** This file bridges chats. If context hits 80% or a new session starts, read this file first to get the project snapshot.
> 2. **Mandatory Update:** Before each handover, update this file with exact state and pending logic.
> 3. **Pruning:** Keep it under 1,500 tokens. Remove completed tasks; the code is the truth, this file is only “work in progress.”
> 4. **Transfer:** Move technical debt and vision changes to `goals.md`.

---

## 🕒 Last Sync: 2026-01-28

## 📍 Mission State (New-Chat Context)

- **Critical Task:** PR2 (NextAction contract + UI generic renderer) in progress.
- **Recent Changes (PR2):**
  - Provider-agnostic `NextAction.kind` contract implemented (redirect | client_confirm | manual_step | external_wait).
  - Stripe/PayPal/SPEI mappers + strategies updated to emit new kinds.
  - UI `NextActionCard` now renders by kind only and emits a generic action request.
  - Checkout page calls `PaymentFlowFacade.performNextAction()` and no longer uses provider-specific logic.
  - Added UI guardrail test to block provider identifiers in NextAction UI files.
  - Added NextActionCard unit tests and updated integration/strategy tests for new kinds.
  - Fixed TS errors: added `ui.continue_action` to i18n types, hardened fake Stripe intent mapper, tightened SPEI spec assertions, and made NextActionCard fallback render safe.
- **Open/Relevant Files:** `docs/ai-active-context.md`, `docs/flow-brain.md`, `docs/architecture-rules.md`, `docs/goals.md`.
- **Error Context:** All tests green after PR2 updates (bun run test).

## 🛠️ Technical Snapshot (Angular)

- **Signal/Observable State:** XState is source of truth; store is projection + fallback + history.
- **Application layout:** `application/{api,orchestration,adapters}` with flow, store, and services under orchestration.
- **Dependency Injection:** `app.config.ts` wires HttpClient interceptors; fake backend interceptor removed.

## 🚀 Git Planning & Workflow

> **RULE:** Atomic tasks for clean PRs.
>
> - **Big Feature:** parent branch -> sub-branches `task/`.
> - **Small Feature:** direct branch off parent.
> - **Deliverable:** branch name + commit message per task.
>
> **Personal Workflow Preferences:**
>
> - We can talk in Spanish, but all code/comments/docs are in English.
> - Always assess if request is a Big or Small Feature.
> - Split implementation into atomic steps.
> - For each step, add branch name + commit message below.

### 📋 Session Backlog (Micro-tasks)

- [x] **Branch:** `chore/remove-fake-backend-interceptor` | **Commit:** `chore(core): remove fake backend interceptor`
- [x] **Branch:** `docs/clean-ports-debt-notes` | **Commit:** `docs: remove port migration requirement`
- [x] **Branch:** `feat/fallback-hardening-limits` | **Commit:** `feat(fallback): enforce limits and expand coverage`
- [x] **Branch:** `feat/ui-qol-utilities` | **Commit:** `feat(ui): add status label pipe, click tracking, and autofocus`
- [x] **Branch:** `docs/fallback-hardening` | **Commit:** `docs(fallback): document limits and reset behavior`
- [x] **Branch:** `feat/i18n-translate-pipe` | **Commit:** `feat(i18n): add template translation pipe`
- [x] **Branch:** `refactor/flow-public-events` | **Commit:** `refactor(flow): separate command and system events`
- [x] **Branch:** `chore/store-fallback-cleanup` | **Commit:** `chore(payments): clean store/fallback visuals`
- [x] **Branch:** `feat/flow-retry-polling` | **Commit:** `feat(flow): add retry/backoff and polling cadence`
- [x] **Branch:** `feat/external-event-mappers` | **Commit:** `feat(flow): add external event mappers`
- [ ] **Branch:** `task/next-action-generic` | **Commit:** `refactor(flow): normalize nextAction kind`

## ⏭️ Immediate Next Action

- [ ] Finish PR2: run targeted tests and finalize PR2 summary.
- [ ] Close docs refresh (update flow brain, cleanup docs).

---

_Note: Prune details older than 3 interactions to preserve tokens._
