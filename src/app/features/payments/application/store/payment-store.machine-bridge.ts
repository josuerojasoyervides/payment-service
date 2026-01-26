// src/app/features/payments/application/store/payment-store.machine-bridge.ts

import { computed, effect, Signal } from '@angular/core';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';
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
    fallbackOrchestrator: FallbackOrchestratorService;
  },
) {
  /**
   * Policy: no surfear errores a UI mientras el fallback está ejecutándose.
   */
  const canSurfaceErrorToUI = (fallback: FallbackState) =>
    fallback.status === 'idle' || fallback.status === 'failed';

  /**
   * Helper: detectar estados "loading" de la máquina
   */
  const isLoadingState = (value: unknown) => {
    return (
      value === 'starting' ||
      value === 'confirming' ||
      value === 'cancelling' ||
      value === 'fetchingStatus'
    );
  };

  /**
   * Snapshot actual (Signal) expuesto por el actor.
   * Ojo: tu servicio ya lo tiene como signal.
   */
  const machineSnapshot: Signal<PaymentFlowSnapshot> = deps.stateMachine.snapshot;

  /**
   * Derivados (computed) para evitar trabajo repetido en effect.
   */
  const machineState = computed(() => machineSnapshot().value);
  const machineContext = computed(() => machineSnapshot().context);

  const machineIntent = computed(() => machineContext().intent);
  const machineError = computed(() => machineContext().error);
  const machineProviderId = computed(() => machineContext().providerId);
  const machineRequest = computed(() => machineContext().request);

  /**
   * ============================================================
   * Effect #0 (DEBUG): ver snapshot en vivo
   * ============================================================
   */
  effect(() => {
    const snap = machineSnapshot();
    console.log('[BRIDGE] state:', snap.value, 'context:', snap.context);
  });

  /**
   * ============================================================
   * Effect #1: reflejar LOADING del statechart al store
   * ============================================================
   */
  effect(() => {
    const state = machineState();

    if (!isLoadingState(state)) return;

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

    // Si fallback estaba activo y recuperamos
    if (store.fallback().status !== 'idle') {
      deps.fallbackOrchestrator.notifySuccess();
    }

    return;
  });

  /**
   * ============================================================
   * Effect #3: errores de máquina → fallback orchestrator / UI error policy
   * ============================================================
   */
  effect(() => {
    const err = machineError();
    if (!err) return;

    // Normalmente tu máquina ya normaliza, pero por seguridad:
    const normalized = normalizePaymentError(err);

    const providerId = machineProviderId() as PaymentProviderId | null;
    const request = machineRequest();

    // Si tenemos provider + request, podemos reportar failure a fallback
    if (providerId && request) {
      const handled = deps.fallbackOrchestrator.reportFailure(
        providerId,
        normalized,
        request,
        false,
      );

      if (handled) {
        applySilentFailureState(store);
        return;
      }
    }

    // No surfear error si fallback está ejecutándose
    if (canSurfaceErrorToUI(store.fallback())) {
      applyFailureState(store, normalized);
    } else {
      applySilentFailureState(store);
    }
  });
}
