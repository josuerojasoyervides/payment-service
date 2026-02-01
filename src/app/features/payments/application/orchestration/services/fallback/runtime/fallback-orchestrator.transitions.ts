import type { WritableSignal } from '@angular/core';
import type { FinishStatus } from '@app/features/payments/application/orchestration/services/fallback/helpers/fallback-orchestrator.types';
import type { FallbackAvailableEvent } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-event.model';
import type {
  FailedAttempt,
  FallbackState,
} from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.types';
import { INITIAL_FALLBACK_STATE } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.types';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

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
  originalRequest: CreatePaymentRequest,
): void {
  state.update((s) => ({
    ...s,
    status: 'auto_executing',
    currentProvider: provider,
    pendingEvent: null,
    isAutoFallback: true,
    originalRequest,
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
    providerId: providerId,
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
