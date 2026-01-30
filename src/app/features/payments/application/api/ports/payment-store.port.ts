import type { Signal } from '@angular/core';
import type {
  PaymentFlowStatus,
  PaymentsState,
} from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type { FallbackAvailableEvent } from '@payments/domain/subdomains/fallback/contracts/fallback-event.event';
import type { FallbackState } from '@payments/domain/subdomains/fallback/contracts/fallback-state.types';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type {
  CurrencyCode,
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type {
  FieldRequirements,
  PaymentOptions,
} from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';

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
 * UI API contract: UI couples to this port + PAYMENT_STATE token only.
 *
 * Enables swapping the implementation (e.g. NgRx, Akita) without breaking UI.
 * Components inject the token and use the port interface; they never import
 * the store or selectors directly.
 *
 * @example
 * ```ts
 * const state = inject(PAYMENT_STATE);
 * readonly loading = state.isLoading;
 * readonly intent = state.intent;
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

  // ============================================================
  // CHECKOUT CATALOG (providers, methods, form, request build)
  // ============================================================

  /** List of available provider IDs. */
  availableProviders(): PaymentProviderId[];

  /** Supported payment methods for a provider. */
  getSupportedMethods(providerId: PaymentProviderId): PaymentMethodType[];

  /** Field requirements for provider+method (for dynamic form). */
  getFieldRequirements(
    providerId: PaymentProviderId,
    method: PaymentMethodType,
  ): FieldRequirements | null;

  /** Build a CreatePaymentRequest from form data. */
  buildCreatePaymentRequest(params: {
    providerId: PaymentProviderId;
    method: PaymentMethodType;
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    options: PaymentOptions;
  }): CreatePaymentRequest;
}
