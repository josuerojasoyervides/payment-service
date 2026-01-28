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

- **Critical Task:** PR4.4 — PayPal capture / finalize pipeline (per provider-integration-plan).
- **Last completed (4.3.3):** clientConfirming stage invokes deps.clientConfirm (orchestration); onDone → reconciling + setIntent, onError → failed + setError. Machine tests: success path (CONFIRM → clientConfirming → reconciling), failure path (clientConfirmReject with PaymentError unsupported_client_confirm → failed, error.code/messageKey asserted). No REFRESH fallback; no provider branching.
- **Last completed (4.3.4.2):** UI provider-coupling guardrail extended: (a) “no infrastructure import” runs on status, return, payment-intent-card + checkout + next-action-card; (b) “no provider identifiers” stays on orchestration entry points only (checkout, next-action-card). Status/Return use provider literals only as static demo (examples, PayPal URL param names), not for orchestration.
- **Last completed (PR4.4.1):** FINALIZE routing made provider-agnostic via ProviderFactoryRegistry capability (mirror of client_confirm). NextActionOrchestratorService resolves handler with factory.getFinalizeHandler?.() ?? null; if missing, throws PaymentError unsupported_finalize with messageKey errors.unsupported_finalize. Added i18n keys (en/es) and tests.
- **Last completed (PR4.4.2):** PayPal finalize/capture capability added behind ProviderFactory (PaypalFinalizeHandler implements FinalizePort and delegates to PayPal confirm/capture via PaypalIntentFacade.confirmIntent). Factory exposes getFinalizeHandler(). Added wiring test proving registry → PayPal factory → handler.execute.
- **Last completed (PR4.4.3):** REDIRECT_RETURNED now routes to finalizing (setExternalEventInput → invoke finalize). Success → reconciling; unsupported_finalize → reconciling (clearError, non-fatal); other errors → failed. Return page no longer uses hardcoded 'stripe' in refreshPaymentByReference. PayPal handler resolves orderId from providerRefs.paymentId (redirect-return merge).
- **Next step:** PR4.4.4 — polish / E2E or next item per provider-integration-plan.
- **Key files:** `ui-provider-coupling.spec.ts`, `payment-flow.persistence.spec.ts`.

## 🛠️ Technical Snapshot

- **clientConfirming:** invoke clientConfirm → onDone (CLIENT_CONFIRM_SUCCEEDED semantics) → reconciling; onError (CLIENT_CONFIRM_FAILED semantics) → failed + setError(PaymentError).
- **Actor:** deps.clientConfirm = firstValueFrom(nextActionOrchestrator.requestClientConfirm(...)); orchestrator uses registry capability.

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

- [ ] PR4.4.4: Polish / E2E or next item per provider-integration-plan.

---

_Note: Prune details older than 3 interactions to preserve tokens._
