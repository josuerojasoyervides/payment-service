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

- **Critical Task:** PR4.3 — Move Stripe client confirmation out of UI into application orchestration (provider-agnostic).
- **Last completed (4.3.2):** Provider-agnostic client-confirm routing via ProviderFactoryRegistry. Optional capability `getClientConfirmHandler?(): ClientConfirmPort | null` on ProviderFactory; orchestrator uses registry.get(providerId).getClientConfirmHandler?.() ?? null. No handler → PaymentError(code: 'unsupported_client_confirm', messageKey: 'errors.unsupported_client_confirm'). StripeJsAdapter not present in repo; Stripe/PayPal factories omit capability (return null).
- **Next step:** 4.3.3 — Wire machine invoke (clientConfirming stage) to orchestration; on success CLIENT_CONFIRM_SUCCEEDED → reconciling; on failure CLIENT_CONFIRM_FAILED with PaymentError.
- **Key files:** `provider-factory.port.ts`, `next-action-orchestrator.service.ts`, `payment-flow-client-confirm.stage.ts`, `payment-flow.actor.service.ts`.

## 🛠️ Technical Snapshot

- **Client-confirm routing:** NextActionOrchestratorService injects ProviderFactoryRegistry; requestClientConfirm resolves handler via factory.getClientConfirmHandler?.() ?? null; no providerId switch in application.
- **Application:** ClientConfirmPort optional on factory; machine clientConfirming invokes deps.clientConfirm (already wired to orchestrator in actor).

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
- [x] **Branch:** `task/next-action-generic` | **Commit:** `refactor(flow): normalize nextAction kind`
- [x] **Branch:** `task/flow-context-reentry` | **Commit:** `feat(flow): add providerRefs and safe context store`
- [ ] **Branch:** `task/flow-finalization` | **Commit:** `feat(flow): add client confirm and finalize pipeline`

## ⏭️ Immediate Next Action

- [ ] PR4.3.3: Wire machine invoke (clientConfirming stage) to orchestration; CLIENT_CONFIRM_SUCCEEDED/FAILED transitions.

---

_Note: Prune details older than 3 interactions to preserve tokens._
