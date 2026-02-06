import type { Signal } from '@angular/core';
import { computed, effect } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import type { PaymentFlowSnapshot } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import { addToHistory } from '@payments/application/orchestration/store/history/payment-store.history';
import { normalizePaymentError } from '@payments/application/orchestration/store/projection/payment-store.errors';
import {
  applyFailureState,
  applyLoadingState,
  applyReadyState,
  applySilentFailureState,
  resetState,
} from '@payments/application/orchestration/store/projection/payment-store.transitions';
import type { PaymentsStoreContext } from '@payments/application/orchestration/store/types/payment-store.types';

/**
 * Bridge: connects the XState machine to PaymentsStore.
 *
 * - The machine is the source of truth for the flow.
 * - The store only projects state for UI + fallback + history.
 */
export function setupPaymentFlowMachineBridge(
  store: PaymentsStoreContext,
  deps: {
    stateMachine: PaymentFlowActorService;
  },
) {
  /**
   * Current snapshot (Signal) exposed by the actor.
   * Note: the service already exposes it as a signal.
   */
  const machineSnapshot: Signal<PaymentFlowSnapshot> = deps.stateMachine.snapshot;

  /**
   * Derived (computed) values to avoid repeated work in effects.
   */
  const machineContext = computed(() => machineSnapshot().context);

  const machineIntent = computed(() => machineContext().intent);
  const machineError = computed(() => machineContext().error);
  const machineProviderId = computed(() => machineContext().providerId);
  const machineRequest = computed(() => machineContext().request);

  /**
   * ============================================================
   * Effect #1: reflect LOADING states from the machine into the store
   * ============================================================
   */
  effect(() => {
    const snapshot = machineSnapshot();
    const state = snapshot.value;

    if (!snapshot.hasTag('loading')) return;

    /**
     * ✅ IMPORTANT:
     * If we are in fetchingStatus (refresh/polling) but we already have an intent,
     * DO NOT set loading because you will "cover" the ready state all the time.
     *
     * This prevents UI/tests from getting stuck in loading.
     */
    if (state === 'fetchingStatus' && machineIntent()) return;

    applyLoadingState(store, machineProviderId() ?? undefined, machineRequest() ?? undefined);
  });

  /**
   * ============================================================
   * Effect #2: when the machine produces a new intent -> READY + history
   * ============================================================
   *
   * Notes:
   * - Only add to history if intent changed (by id).
   * - Avoid duplicates when polling refreshes the same intent.
   */
  let lastIntentId: string | null = null;

  effect(() => {
    const intent = machineIntent();

    if (!intent) return;

    applyReadyState(store, intent);

    const providerId = machineProviderId() as PaymentProviderId | null;
    if (!providerId) return;

    const intentIdValue = intent.id.value;
    if (intentIdValue !== lastIntentId) {
      lastIntentId = intentIdValue;
      addToHistory(store, intent, providerId);
    }
    return;
  });

  /**
   * ============================================================
   * Effect #2b: fallback candidate without intent -> ready (silent)
   * ============================================================
   */
  effect(() => {
    const snapshot = machineSnapshot();
    if (!snapshot.hasTag('fallback')) return;
    if (machineIntent()) return;

    applySilentFailureState(store);
  });

  /**
   * ============================================================
   * Effect #2c: resilience states -> ready (silent)
   * ============================================================
   */
  effect(() => {
    const snapshot = machineSnapshot();
    if (!snapshot.hasTag('resilience')) return;

    applySilentFailureState(store);
  });

  /**
   * ============================================================
   * Effect #2d: machine idle -> clear store so tests/UI see consistent idle
   * ============================================================
   */
  effect(() => {
    const snapshot = machineSnapshot();
    if (!snapshot.hasTag('idle')) return;

    resetState(store);
  });

  /**
   * ============================================================
   * Effect #3: machine errors -> fallback orchestrator / UI error policy
   * ============================================================
   */
  effect(() => {
    const snapshot = machineSnapshot();
    const err = machineError();
    if (!snapshot.hasTag('error') || !err) return;

    // The machine usually normalizes, but keep a safety check:
    const normalized = normalizePaymentError(err);

    applyFailureState(store, normalized);
  });
}
