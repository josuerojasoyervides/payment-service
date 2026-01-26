// src/app/features/payments/application/store/payment-store.machine-bridge.ts

import { computed, effect, Signal } from '@angular/core';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

import { PaymentFlowActorService } from '../state-machine/payment-flow.actor.service';
import { PaymentFlowSnapshot } from '../state-machine/payment-flow.types';
import { normalizePaymentError } from './payment-store.errors';
import { addToHistory } from './payment-store.history';
import {
  applyFailureState,
  applyLoadingState,
  applyReadyState,
  applySilentFailureState,
} from './payment-store.transitions';
import type { PaymentsStoreContext } from './payment-store.types';

/**
 * Bridge: conecta la máquina de XState con el PaymentsStore.
 *
 * - La máquina es source of truth del flow.
 * - El store solo proyecta estado para UI + fallback + history.
 */
export function setupPaymentFlowMachineBridge(
  store: PaymentsStoreContext,
  deps: {
    stateMachine: PaymentFlowActorService;
  },
) {
  /**
   * Snapshot actual (Signal) expuesto por el actor.
   * Ojo: tu servicio ya lo tiene como signal.
   */
  const machineSnapshot: Signal<PaymentFlowSnapshot> = deps.stateMachine.snapshot;

  /**
   * Derivados (computed) para evitar trabajo repetido en effect.
   */
  const machineContext = computed(() => machineSnapshot().context);

  const machineIntent = computed(() => machineContext().intent);
  const machineError = computed(() => machineContext().error);
  const machineProviderId = computed(() => machineContext().providerId);
  const machineRequest = computed(() => machineContext().request);

  /**
   * ============================================================
   * Effect #1: reflejar LOADING del statechart al store
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
   * Effect #2: cuando la máquina produce intent nuevo → READY + history
   * ============================================================
   *
   * Importante:
   * - solo agregamos a history si el intent cambió (por id).
   * - evitamos duplicados cuando polling refresca el mismo intent.
   */
  let lastIntentId: string | null = null;

  effect(() => {
    const intent = machineIntent();

    if (!intent) return;

    applyReadyState(store, intent);

    const providerId = machineProviderId() as PaymentProviderId | null;
    if (!providerId) return;

    if (intent.id !== lastIntentId) {
      lastIntentId = intent.id;
      addToHistory(store, intent, providerId);
    }
    return;
  });

  /**
   * ============================================================
   * Effect #2b: fallback candidate without intent → ready (silent)
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
   * Effect #3: errores de máquina → fallback orchestrator / UI error policy
   * ============================================================
   */
  effect(() => {
    const snapshot = machineSnapshot();
    const err = machineError();
    if (!snapshot.hasTag('error') || !err) return;

    // Normalmente tu máquina ya normaliza, pero por seguridad:
    const normalized = normalizePaymentError(err);

    applyFailureState(store, normalized);
  });
}
