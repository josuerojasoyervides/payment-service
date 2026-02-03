# Application layer analysis (Payments)

## Goal

Primary: UI-agnostic + infra-agnostic.
Optional later: framework-agnostic.

## Map of application

Key folders and files:

- src/app/features/payments/application/
  - adapters/
    - events/ (flow/payment-flow.events.ts, external-event.adapter.ts,
      webhook-ingestion.service.ts, mappers/payment-flow-return.mapper.ts)
    - state/ngrx-signals-state.adapter.ts
    - telemetry/ (composite, dev-only, prod-only, types)
  - api/
    - ports/ (payment-store.port.ts, provider-factory.port.ts,
      payment-gateway.port.ts, ...)
    - tokens/ (store, provider, operations, telemetry, webhook)
    - contracts/ (redirect-return\*.ts, key-value-storage.contract.ts,
      payment-provider-catalog.types.ts,
      checkout-field-requirements.types.ts [deprecated re-export],
      spei-display-config.types.ts [deprecated re-export])
    - facades/payment-history.facade.ts
    - builders/base-payment-request.builder.ts
    - testing/ (flow harness, mock state, vo helpers)
  - orchestration/
    - use-cases/intent/\*.use-case.ts
    - flow/ (payment-flow.machine.ts, actor.service.ts, machine-driver.ts,
      stages/, policy/, context/, persistence/)
    - registry/ (provider-factory.registry.ts,
      provider-descriptor.registry.ts, provider-method-policy.registry.ts)
    - services/ (fallback/, next-action/)
    - store/ (payment-store.ts, projection/, actions/, history/, types/, utils/)
    - testing/ (scenario harness, stress specs)

Incoming dependencies (who consumes application):

- UI uses PAYMENT_STATE / PAYMENT_CHECKOUT_CATALOG tokens and ports in pages/components.
- Config composes DI: src/app/features/payments/config/payment.providers.ts.
- Infrastructure registers factories/strategies/gateways and webhook normalizers.
- Tests consume application harnesses in application/testing.

Outgoing dependencies (application depends on):

- Domain: src/app/features/payments/domain/\*\*
- Angular core + signals + TestBed.
- RxJS and XState.
- Core logging: src/app/core/logging/\*\*
- Shared utils: shared/rxjs/safe-defer.ts and shared idempotency.
- Browser APIs: localStorage, window (see P0).

## API boundary (application/api)

- application/api is the integration surface for UI, infrastructure, and config.
- It can re-export presentation contracts and import internal application types when they are part of the public contract.
- Prefer `import type` for internal references to avoid runtime coupling; keep api curated (no internal-only exports).
- UI-facing ports live here intentionally; core ports remain UI-agnostic.

## Prioritized findings

### P0

Browser APIs inside application (persistence / navigation)

- Symptom: PaymentFlowActorService uses localStorage directly; PaymentFlowMachineDriver navigates
  via window.location.href.
- Impact: application is coupled to browser; SSR/tests without DOM are fragile; boundary leak.
- Where:
  - src/app/features/payments/application/orchestration/flow/payment-flow.actor.service.ts
  - src/app/features/payments/application/orchestration/flow/payment-flow-machine-driver.ts
- Rule broken: application should orchestrate, not handle infrastructure IO or browser APIs.
- Proposal: introduce ports and tokens for storage and navigation in api/ports + api/tokens.
  Infra implements adapters (BrowserStorageAdapter, WindowNavigatorAdapter). Config is the
  composition root that wires them. UI only consumes the ports.
- Risk/tradeoff: DI changes and test updates.

### P1

UI contracts and framework types exposed by application

- Symptom: UI-facing ports and presentation metadata were mixed with core contracts; presentation types lived under application/api/contracts.
- Impact: confusion about what is public API vs core-only; risk of UI-only types leaking into orchestration.
- Where:
  - src/app/features/payments/application/api/ports/payment-store.port.ts
  - src/app/features/payments/application/api/ports/provider-factory.port.ts
  - src/app/features/payments/application/api/contracts/checkout-field-requirements.types.ts (deprecated re-export)
  - src/app/features/payments/application/api/contracts/spei-display-config.types.ts (deprecated re-export)
  - src/app/features/payments/presentation/contracts/\*\*
  - src/app/features/payments/presentation/tokens/provider/\*\*
- Rule broken: application core should remain UI-agnostic; application/api must be a curated integration surface.
- Proposal: keep UI ports in application/api as explicit UI contracts; enforce a UI-agnostic core port.
  Split provider metadata into capabilities (application) vs presentation (UI).
  Move UI-only contracts/tokens to @payments/presentation and keep deprecated re-exports in
  application/api for a short migration window.
- Risk/tradeoff: migration in UI/infra; requires docs and dependency rules to prevent regressions.
- Notes: checkout-field-requirements and spei-display-config now live in presentation contracts
  and are re-exported from application/api for compatibility.

Redirect return parsing in application

- Symptom: application parses provider-specific keys (token, payment_intent, setup_intent).
- Impact: provider-specific knowledge leaks into application; UI becomes provider-aware if moved there.
- Where:
  - src/app/features/payments/application/api/ports/payment-store.port.ts
  - src/app/features/payments/application/adapters/state/ngrx-signals-state.adapter.ts
  - src/app/features/payments/application/adapters/events/external/mappers/payment-flow-return.mapper.ts
- Rule broken: application should not parse HTTP/UI input; UI should not know provider keys.
- Proposal: UI only forwards raw query params in a neutral container
  (RedirectReturnRaw { query: Record<string, string | string[]> }).
  Infrastructure provides per-provider return normalizers (via a multi-token registry)
  that map raw data to RedirectReturnedPayload (or NormalizedReturn). Application only
  receives normalized payloads.
- Risk/tradeoff: adds a normalizer registry in infra; avoids provider-aware UI.

### P2

Provider method policy registry hard-codes methods

- Symptom: registry iterates ['card','spei'].
- Impact: adding methods requires changing application (OCP violation).
- Where: src/app/features/payments/application/orchestration/registry/provider-method-policy.registry.ts
- Rule broken: extensibility; app should not hard-code provider methods.
- Proposal: derive methods from ProviderFactoryRegistry.getSupportedMethods() or extend policy port
  with a supported methods list.
- Risk/tradeoff: small interface change.

Telemetry depends on string state names

- Symptom: EFFECT_STATES uses hard-coded state names.
- Impact: telemetry desync when machine changes; inconsistent observability.
- Where: src/app/features/payments/application/orchestration/flow/payment-flow.actor.service.ts
- Rule broken: single source of truth for state semantics.
- Proposal: use tags in machine or expose effect state list from policy.
- Risk/tradeoff: minor refactor and test updates.

## Incremental refactor plan (stop points + DoD)

1. Add environment ports for storage and navigation.
   - Files: payment-flow.actor.service.ts, payment-flow-machine-driver.ts,
     new ports/tokens under application/api, config/payment.providers.ts.
   - Better: no browser API use inside application.
   - Default providers: config always provides FLOW_CONTEXT_STORAGE (NoopStorage by default,
     BrowserStorageAdapter in browser) and EXTERNAL_NAVIGATOR (Noop or Throwing in dev,
     browser adapter in real runtime).
   - DoD: rg "localStorage|window.location" in application returns no results.
   - Tests: bun run test src/app/features/payments/application/orchestration/flow/payment-flow.machine.spec.ts
     bun run test src/app/features/payments/application/orchestration/flow/payment-flow.actor.telemetry.spec.ts
   - Stop point: app works with new adapters and tests pass.

2. Define core contracts + core port (UI-agnostic) and keep a UI-facing port in application/api.
   - Files: payment-store.port.ts, ngrx-signals-state.adapter.ts, config tokens.
   - Better: core remains UI-agnostic; UI port is an explicit contract in application/api.
   - DoD: core port has no UI-only types; UI port may reference presentation contracts.
   - Tests: bun run test src/app/features/payments/application/orchestration/store/payment-store.spec.ts
   - Stop point: UI still uses signals; core port compiles.

3. Move UI-only contracts/tokens to presentation and keep deprecated re-exports in application/api.
   - Files: move checkout-field-requirements.types.ts, spei-display-config.types.ts,
     and provider UI tokens to presentation; keep deprecated re-exports in application/api.
   - Better: presentation contracts are owned by UI/presentation; application/api exposes them only for compatibility.
   - DoD: new definitions live in @payments/presentation; application/api/contracts contain only deprecated re-exports.
   - Dependency: do this after Step 2 to avoid churn in core port/contracts.
   - Stop point: UI compiles using new locations.

4. Replace return parsing with infra normalizers.
   - Files: new RedirectReturnRaw contract in api/contracts; new normalizer port+token;
     infra normalizers for Stripe/PayPal; application consumes normalized payload only.
   - Source of providerId (choose one, no heuristics in UI/app):
     - Preferred: persist expectedProviderId + returnNonce before redirect (storage port).
     - Alternative: providerId in route param (e.g. /payments/return/:providerId).
   - Better: provider specifics stay in infra; UI stays provider-agnostic.
   - Selection rule: application selects only the normalizer matching expectedProviderId
     (or route providerId) and does not iterate all normalizers to find a match.
   - Pending redirect context (if using preferred path):
     - expectedProviderId
     - returnNonce (or correlation id)
     - createdAtMs
     - expiresAtMs (or ttlMs)
   - DoD: if missing/expired -> controlled error + telemetry (no secrets).
   - DoD: no provider detection heuristics in UI/app; rg "payment_intent|setup_intent"
     in application returns 0 hits.
   - Tests: bun run test src/app/features/payments/ui/pages/return/return.page.spec.ts
     bun run test src/app/features/payments/infrastructure/\*\*/redirect-return-normalizer.spec.ts
   - Stop point: return flow still works.

5. Make ProviderMethodPolicyRegistry method list dynamic.
   - Files: provider-method-policy.registry.ts (and port if needed).
   - Better: add new methods without modifying application.
   - DoD: registry tests cover a new method without application changes.
   - Stop point: existing providers still work.

6. Stabilize telemetry with machine tags or policy-driven list.
   - Files: payment-flow.actor.service.ts, payment-flow.machine.ts.
   - Better: telemetry aligned with machine state semantics.
   - DoD: effect telemetry uses tags or exported consts, not hard-coded strings.
   - Tests: bun run test src/app/features/payments/application/adapters/telemetry/flow-telemetry.spec.ts
   - Stop point: telemetry events still emitted as expected.

## Suggested code changes (snippets)

### Storage port

BEFORE (application uses localStorage):

```
// payment-flow.actor.service.ts
function createFlowContextStore(): FlowContextStore | null {
  if (typeof globalThis === 'undefined') return null;
  if (!('localStorage' in globalThis)) return null;
  return new FlowContextStore(globalThis.localStorage);
}
```

AFTER (injectable storage port in api/contracts or api/ports):

```
// api/contracts/key-value-storage.contract.ts
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
```

```
// api/tokens/flow/flow-context-storage.token.ts
import { InjectionToken } from '@angular/core';
import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';

export const FLOW_CONTEXT_STORAGE = new InjectionToken<KeyValueStorage>('FLOW_CONTEXT_STORAGE');
```

```
// payment-flow.actor.service.ts
import { FLOW_CONTEXT_STORAGE } from '@payments/application/api/tokens/flow/flow-context-storage.token';

private readonly storage = inject(FLOW_CONTEXT_STORAGE);
private readonly flowContextStore = new FlowContextStore(this.storage);
```

Note: prefer a Null Object provider (NoopStorage) over optional injection to avoid
silently missing DI wiring. In dev, log a health warning if NoopStorage is used.
Suggested behavior:

- NoopStorage.getItem -> null
- NoopStorage.setItem/removeItem -> no-op
- dev-only warning emitted once (guard boolean) to avoid log spam

### External navigation port

BEFORE (window.location in application):

```
// payment-flow-machine-driver.ts
private navigateToExternal(url: string): void {
  if (typeof window === 'undefined') return;
  window.location.href = url;
}
```

AFTER (navigator port in api/ports):

```
// api/ports/external-navigator.port.ts
export interface ExternalNavigatorPort {
  navigate(url: string): void;
}
```

```
// api/tokens/navigation/external-navigator.token.ts
import { InjectionToken } from '@angular/core';
import type { ExternalNavigatorPort } from '@payments/application/api/ports/external-navigator.port';

export const EXTERNAL_NAVIGATOR = new InjectionToken<ExternalNavigatorPort>('EXTERNAL_NAVIGATOR');
```

```
// payment-flow-machine-driver.ts
import { EXTERNAL_NAVIGATOR } from '@payments/application/api/tokens/navigation/external-navigator.token';

private readonly navigator = inject(EXTERNAL_NAVIGATOR);

private navigateToExternal(url: string): void {
  this.navigator.navigate(url);
}
```

Example default navigators (for config wiring)

```
// infra/adapters or config helpers
export class NoopExternalNavigator implements ExternalNavigatorPort {
  private warned = false;

  navigate(_url: string): void {
    if (!this.warned) {
      this.warned = true;
      // logger.warn('[payments] External navigation requested but NoopExternalNavigator is active');
    }
  }
}

export class ThrowingExternalNavigator implements ExternalNavigatorPort {
  navigate(url: string): void {
    throw new Error(`[payments] External navigation requested without navigator wiring: ${url}`);
  }
}
```

Suggested policy:

- Throwing in dev/test to fail fast on wiring gaps.
- Noop in SSR/prod to avoid hard crashes.

### Redirect return normalization (infra)

BEFORE (application parses query params):

```
// payment-store.port.ts
notifyRedirectReturned(queryParams: Record<string, unknown>): void;
```

AFTER (application accepts normalized payload; raw stays outside app):

```
// api/contracts/redirect-return.contract.ts
export interface RedirectReturnRaw {
  // Multi-values allowed; normalize in infra normalizers.
  // Canonical rule: last value wins when flattening repeated keys.
  query: Record<string, string | string[]>;
}
```

Example: flattening URLSearchParams with last-wins semantics

```
// ui/return-page or shared helper
// Convert URLSearchParams -> RedirectReturnRaw.query (last wins)
export function toRedirectReturnRaw(params: URLSearchParams): RedirectReturnRaw {
  const query: Record<string, string | string[]> = {};

  for (const [key, value] of params.entries()) {
    const prev = query[key];

    if (prev === undefined) {
      query[key] = value;
      continue;
    }

    // last wins: keep array and let normalizer pick the last element
    if (Array.isArray(prev)) {
      query[key] = [...prev, value];
    } else {
      query[key] = [prev, value];
    }
  }

  return { query };
}
```

```
// api/contracts/redirect-return-normalized.contract.ts
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export interface RedirectReturnedPayload {
  providerId: PaymentProviderId;
  referenceId: string;
  returnNonce?: string;
}
```

```
// api/ports/redirect-return-normalizer.port.ts
import type { RedirectReturnRaw } from '@payments/application/api/contracts/redirect-return.contract';
import type { RedirectReturnedPayload } from '@payments/application/api/contracts/redirect-return-normalized.contract';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export interface RedirectReturnNormalizerPort {
  readonly providerId: PaymentProviderId;
  normalize(raw: RedirectReturnRaw): RedirectReturnedPayload | null;
}
```

```
// payment-store.port.ts
import type { RedirectReturnedPayload } from '@payments/application/api/contracts/redirect-return-normalized.contract';

notifyRedirectReturned(payload: RedirectReturnedPayload): void;
```

Note: providerId should come from persisted expectedProviderId or a route param.
Avoid provider detection heuristics in UI/application.
Infra normalizers must avoid logging raw query params; telemetry should include only
whitelisted fields (providerId, referenceId sanitized, presence flags).
Infra normalizers should normalize multi-values to readonly string[] internally and
apply a consistent rule (last wins).
If a normalizer receives a string[] for a key, it must take the last element
(`arr[arr.length - 1]`).

Suggested wiring for multi-provider normalizers:

```
// api/tokens/redirect/redirect-return-normalizers.token.ts
import { InjectionToken } from '@angular/core';
import type { RedirectReturnNormalizerPort } from '@payments/application/api/ports/redirect-return-normalizer.port';

export const REDIRECT_RETURN_NORMALIZERS =
  new InjectionToken<RedirectReturnNormalizerPort[]>('REDIRECT_RETURN_NORMALIZERS');
```

```
// infra provide-*.ts
{ provide: REDIRECT_RETURN_NORMALIZERS, useClass: StripeRedirectReturnNormalizer, multi: true },
{ provide: REDIRECT_RETURN_NORMALIZERS, useClass: PaypalRedirectReturnNormalizer, multi: true },
```

## Layering guardrails (checks)

- rg "@payments/ui" src/app/features/payments/application --glob "\*.ts" returns 0 hits.
- rg "@angular/router|ActivatedRoute|Router" src/app/features/payments/application --glob "\*.ts" returns 0 hits.
- rg "@payments/presentation" src/app/features/payments/application/orchestration --glob "\*.ts" returns 0 hits.
- application/api may import internal application types, but only via `import type` (manual review).

## Compatibility strategy

- Temporary re-exports with /\*_ @deprecated _/ in application for UI-only contracts/tokens.
- Migration window: 1-2 PRs with both paths valid.
- Delete plan: remove deprecated re-exports after UI + infra consumers move.

## Checklist

- rg "localStorage" src/app/features/payments/application returns no results.
- rg "window.location" src/app/features/payments/application returns no results.
- rg "payment_intent|setup_intent" src/app/features/payments/application returns no results.
- rg "globalThis[.]localStorage|window[.]" src/app/features/payments/application returns no results.
- rg "labelKey|placeholderKey|icon|FieldRequirements|display-config|instructionsKey" src/app/features/payments/application/orchestration --glob "\*.ts" returns no results.
- rg "labelKey|placeholderKey|icon|FieldRequirements|display-config|instructionsKey" src/app/features/payments/application/api is reviewed; only UI-facing ports or deprecated re-exports.
- rg "payment_intent|setup_intent|token" src/app/features/payments --glob "\*.spec.ts" is reviewed; ideally 0 hits; move to infra normalizer tests if needed.
- application/api imports from adapters/orchestration are type-only (manual review).
- Tests pass:
  - bun run test src/app/features/payments/application/orchestration/flow/payment-flow.machine.spec.ts
  - bun run test src/app/features/payments/application/orchestration/flow/payment-flow.actor.telemetry.spec.ts
  - bun run test src/app/features/payments/application/orchestration/store/payment-store.spec.ts
  - bun run test src/app/features/payments/tests/payments-boundaries.spec.ts
  - bun run lint:fix (or project equivalent)
  - bun run dep:check (or project equivalent)
