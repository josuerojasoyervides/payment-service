import type { Signal } from '@angular/core';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type {
  PaymentFlowStatus,
  PaymentsState,
} from '@payments/application/orchestration/store/payment-store.state';
import type { FallbackAvailableEvent } from '@payments/domain/models/fallback/fallback-event.types';
import type { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';

/**
 * Unsubscribe function.
 */
export type Unsubscribe = () => void;

/**
 * Debug summary of state.
 */
export interface PaymentDebugSummary {
  status: PaymentFlowStatus;
  intentId: string | null;
  provider: PaymentProviderId | null;
  fallbackStatus: FallbackState['status'];
  isAutoFallback: boolean;
  historyCount: number;
}

/**
 * Payments state port.
 *
 * This interface defines the contract that any state implementation
 * must satisfy. It decouples components from the concrete implementation
 * (NgRx Signals, Akita, NGXS, etc.).
 *
 * Principles:
 * - Components only know this port
 * - Concrete implementation is injected via token
 * - Eases testing and technology changes
 *
 * @example
 * ```typescript
 * // In a component
 * private readonly state = inject(PAYMENT_STATE);
 *
 * readonly isLoading = this.state.isLoading;
 * readonly intent = this.state.intent;
 *
 * pay() {
 *   this.state.startPayment(request, 'stripe');
 * }
 * ```
 */
export interface PaymentStorePort {
  // ============================================================
  // REACTIVE STATE (Signals)
  // ============================================================

  /** Full state as a signal (for advanced cases) */
  readonly state: Signal<PaymentsState>;

  /** Whether a payment is in progress */
  readonly isLoading: Signal<boolean>;

  /** Whether a payment completed successfully */
  readonly isReady: Signal<boolean>;

  readonly hasError: Signal<boolean>;

  readonly intent: Signal<PaymentIntent | null>;

  readonly error: Signal<PaymentError | null>;

  readonly selectedProvider: Signal<PaymentProviderId | null>;

  readonly hasPendingFallback: Signal<boolean>;

  readonly isAutoFallbackInProgress: Signal<boolean>;

  readonly isFallbackExecuting: Signal<boolean>;

  readonly isAutoFallback: Signal<boolean>;

  readonly pendingFallbackEvent: Signal<FallbackAvailableEvent | null>;

  readonly fallbackState: Signal<FallbackState>;

  readonly historyCount: Signal<number>;

  readonly lastHistoryEntry: Signal<PaymentHistoryEntry | null>;

  readonly history: Signal<PaymentHistoryEntry[]>;

  readonly debugSummary: Signal<PaymentDebugSummary>;

  /**
   * Get a snapshot of the current state.
   * Prefer using signals directly.
   */
  getSnapshot(): Readonly<PaymentsState>;

  /**
   * Subscribe to state changes (legacy observer pattern).
   * Prefer using signals with effect().
   *
   * @returns Function to cancel subscription
   */
  subscribe(listener: () => void): Unsubscribe;

  // ============================================================
  // PAYMENT ACTIONS
  // ============================================================

  /**
   * Start a new payment.
   */
  startPayment(
    request: CreatePaymentRequest,
    providerId: PaymentProviderId,
    context?: StrategyContext,
  ): void;

  /**
   * Confirm an existing payment.
   */
  confirmPayment(request: ConfirmPaymentRequest, providerId: PaymentProviderId): void;

  /**
   * Cancel an existing payment.
   */
  cancelPayment(request: CancelPaymentRequest, providerId: PaymentProviderId): void;

  /**
   * Refresh payment status.
   */
  refreshPayment(request: GetPaymentStatusRequest, providerId: PaymentProviderId): void;

  // ============================================================
  // UI ACTIONS
  // ============================================================

  /**
   * Select a provider.
   */
  selectProvider(providerId: PaymentProviderId): void;

  /**
   * Clear current error.
   */
  clearError(): void;

  /**
   * Reset to initial state.
   */
  reset(): void;

  /**
   * Clear history.
   */
  clearHistory(): void;

  // ============================================================
  // FALLBACK ACTIONS
  // ============================================================

  /**
   * Execute a fallback with the selected provider.
   */
  executeFallback(providerId: PaymentProviderId): void;

  /**
   * Cancel pending fallback.
   */
  cancelFallback(): void;
}
