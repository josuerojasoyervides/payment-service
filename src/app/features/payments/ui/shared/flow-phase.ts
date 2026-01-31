import { computed, type Signal } from '@angular/core';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';

/**
 * UI-derived phase of the payment flow.
 * Used for phase-driven rendering (e.g. show form vs show result).
 */
export type FlowPhase =
  | 'editing'
  | 'submitting'
  | 'action_required'
  | 'processing'
  | 'done'
  | 'failed'
  | 'fallback_pending'
  | 'fallback_executing';

/**
 * Derives a single FlowPhase from the payment state port.
 * Uses only port signals; precedence order matters.
 */
export function deriveFlowPhase(state: PaymentFlowPort): Signal<FlowPhase> {
  return computed(() => {
    if (state.hasPendingFallback()) return 'fallback_pending';
    if (state.isFallbackExecuting()) return 'fallback_executing';
    if (state.hasError() || state.isFailed()) return 'failed';
    if (state.requiresUserAction()) return 'action_required';
    if (state.isProcessing()) return 'processing';
    if (state.isSucceeded() || state.isReady()) return 'done';
    if (state.isLoading()) return 'submitting';
    return 'editing';
  });
}
