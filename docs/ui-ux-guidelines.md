# UI/UX Code (Payments)

## Purpose

Define non-negotiable UI/UX behavior and theming decisions for the payments experience.

## Flow Phases (Source of Truth)

- `editing`: show form, allow provider/method selection, allow payment initiation.
- `submitting`: show primary loading state for the initial request only.
- `processing`: intent exists and status is `processing` (polling in background).
- `action_required`: show the next-action UI.
- `done`: show successful result.
- `failed`: show error result.
- `fallback_pending` / `fallback_executing`: show fallback UI.

## Processing UX Rules

- **Partial block**: while `processing`, avoid full-screen loading.
- **No manual refresh**: the UI must not expose manual “refresh status” actions.
- **New payment disabled**: do not allow starting a new payment while the current intent is `processing`.

## Status Page Rules

- **Block the form during polling**: input, provider selection, quick examples, and search should be disabled while the flow is `processing` or `loading`.
- **Result card actions** remain contextual: confirm/cancel are allowed only if intent status permits.

## Polling Behavior (User-Facing)

- Polling exists to converge `processing` intents to a terminal status without user intervention.
- **Do not poll while `requires_confirmation`**: show action-required UI and wait for `REDIRECT_RETURNED`/webhook reconciliation.
- UI should remain stable during polling; avoid flicker or global “loading” states.

## Theme System (Dark by Default)

- **Default theme is dark**.
- **No inline scripts in `index.html`** for theme initialization.
- **No changes to the original CSS file** for dark mode; use an override stylesheet.
- Theme is applied via `data-theme="dark|light"` on `<html>`.
- Theme toggle is a standalone component; navbar should only render it.

## Components & Integration

- Theme toggle uses `ThemeService` for persistence.
- Dark overrides live in `src/styles.dark.scss` and are loaded after `src/styles.scss`.

## I18n Keys

- `ui.theme_toggle`
- `ui.theme_dark`
- `ui.theme_light`
