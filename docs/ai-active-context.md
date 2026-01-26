# 🧠 Active Context & Session State

> **SURVIVAL INSTRUCTIONS (CROSS-SESSION CONTINUITY):**
>
> 1. **Primary Mission:** This file bridges chats. If context hits 80% or a new session starts, read this file first to get the project snapshot.
> 2. **Mandatory Update:** Before each handover, update this file with exact state and pending logic.
> 3. **Pruning:** Keep it under 1,500 tokens. Remove completed tasks; the code is the truth, this file is only “work in progress.”
> 4. **Transfer:** Move technical debt to `stabilization-plan.md` and vision changes to `goals.md`.

---

## 🕒 Last Sync: 2026-01-26

## 📍 Mission State (New-Chat Context)

- **Critical Task:** Language normalization + planning integration (English-only code/docs).
- **Open/Relevant Files:** `docs/ai-active-context.md`, `docs/architecture-rules.md`, `docs/stabilization-plan.md`, `docs/goals.md`.
- **Error Context:** None.

## 🛠️ Technical Snapshot (Angular)

- **Signal/Observable State:** XState is source of truth; store is projection + fallback + history.
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
- [ ] **Branch:** `docs/fallback-hardening` | **Commit:** `docs(fallback): document limits and reset behavior`
- [x] **Branch:** `feat/i18n-translate-pipe` | **Commit:** `feat(i18n): add template translation pipe`
- [x] **Branch:** `refactor/flow-public-events` | **Commit:** `refactor(flow): separate command and system events`
- [x] **Branch:** `chore/store-fallback-cleanup` | **Commit:** `chore(payments): clean store/fallback visuals`
- [ ] **Branch:** `feat/flow-retry-polling` | **Commit:** `feat(flow): add retry/backoff and polling cadence` (active)

## ⏭️ Immediate Next Action

- [ ] Finish flow retry/polling branch (verify, commit, update backlog).

---

_Note: Prune details older than 3 interactions to preserve tokens._
