import { WritableSignal } from '@angular/core';
import { FallbackAvailableEvent } from '@payments/domain/models/fallback/fallback-event.types';
import {
  FailedAttempt,
  FallbackState,
  INITIAL_FALLBACK_STATE,
} from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

import { FinishStatus } from './fallback-orchestrator.types';

/**
 * ✅ Reset / Initial
 */
export function resetTransition(state: WritableSignal<FallbackState>): void {
  state.set(INITIAL_FALLBACK_STATE);
}

/**
 * ✅ Manual fallback flow: pending → executing
 */
export function setPendingManualTransition(
  state: WritableSignal<FallbackState>,
  event: FallbackAvailableEvent,
): void {
  state.update((s) => ({
    ...s,
    status: 'pending',
    pendingEvent: event,
    isAutoFallback: false,
  }));
}

export function setExecutingTransition(
  state: WritableSignal<FallbackState>,
  provider: PaymentProviderId,
): void {
  state.update((s) => ({
    ...s,
    status: 'executing',
    pendingEvent: null,
    currentProvider: provider,
    isAutoFallback: false,
  }));
}

/**
 * ✅ Auto fallback flow: auto_executing
 */
export function setAutoExecutingTransition(
  state: WritableSignal<FallbackState>,
  provider: PaymentProviderId,
): void {
  state.update((s) => ({
    ...s,
    status: 'auto_executing',
    currentProvider: provider,
    pendingEvent: null,
    isAutoFallback: true,
  }));
}

/**
 * ✅ Failure tracking (doesn't change status, only records attempt)
 */
export function registerFailureTransition(
  state: WritableSignal<FallbackState>,
  providerId: PaymentProviderId,
  error: PaymentError,
  wasAutoFallback: boolean,
): void {
  const attempt: FailedAttempt = {
    provider: providerId,
    error,
    timestamp: Date.now(),
    wasAutoFallback,
  };

  state.update((s) => ({
    ...s,
    failedAttempts: [...s.failedAttempts, attempt],
    currentProvider: providerId,
  }));
}

/**
 * ✅ Terminal transitions
 */
export function setTerminalTransition(
  state: WritableSignal<FallbackState>,
  status: FinishStatus,
): void {
  state.update((s) => ({
    ...s,
    status,
    pendingEvent: null,
    currentProvider: null,
    isAutoFallback: false,
  }));
}

/**
 * ✅ Terminal special-case (failed due to missing original request)
 */
export function setFailedNoRequestTransition(state: WritableSignal<FallbackState>): void {
  state.update((s) => ({
    ...s,
    status: 'failed',
    pendingEvent: null,
    currentProvider: null,
    isAutoFallback: false,
  }));
}
