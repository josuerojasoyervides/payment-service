import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { StrategyContext } from '@payments/application/ports/payment-strategy.port';
import { FallbackAvailableEvent } from '@payments/domain/models/fallback/fallback-event.types';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';

import { PaymentDebugSummary, PaymentStorePort, Unsubscribe } from '../ports/payment-store.port';
import { PaymentHistoryEntry } from '../store/history/payment-store.history.types';
import { PaymentsStore } from '../store/payment-store';
import { PaymentsState } from '../store/projection/payment-store.state';

/**
 * Adapter that implements PaymentStatePort using NgRx Signals.
 *
 * This adapter lets components use the port without knowing
 * the concrete implementation. If you later switch
 * from NgRx Signals to another library, you only need a new adapter.
 *
 * Pattern: Adapter
 * - Adapts PaymentsStore interface to PaymentStatePort contract
 * - Components do not access PaymentsStore directly
 * - Eases testing with port mocks
 *
 * @example
 * ```typescript
 * // In payment.providers.ts
 * { provide: PAYMENT_STATE, useClass: NgRxSignalsStateAdapter }
 *
 * // In a component
 * private readonly state = inject(PAYMENT_STATE);
 * readonly isLoading = this.state.isLoading; // Signal<boolean>
 * ```
 */
@Injectable()
export class NgRxSignalsStateAdapter implements PaymentStorePort {
  private readonly store = inject(PaymentsStore);

  // ============================================================
  // REACTIVE STATE (delegated to store)
  // ============================================================

  readonly state: Signal<PaymentsState> = computed(() => ({
    status: this.store.status(),
    intent: this.store.intent(),
    error: this.store.error(),
    selectedProvider: this.store.selectedProvider(),
    currentRequest: this.store.currentRequest(),
    fallback: this.store.fallback(),
    history: this.store.history(),
  }));

  readonly isLoading: Signal<boolean> = this.store.isLoading;
  readonly isReady: Signal<boolean> = this.store.isReady;
  readonly hasError: Signal<boolean> = this.store.hasError;
  readonly intent: Signal<PaymentIntent | null> = this.store.currentIntent;
  readonly error: Signal<PaymentError | null> = this.store.currentError;
  readonly selectedProvider: Signal<PaymentProviderId | null> = computed(() =>
    this.store.selectedProvider(),
  );

  // More descriptive states based on intent
  readonly requiresUserAction: Signal<boolean> = this.store.requiresUserAction;
  readonly isSucceeded: Signal<boolean> = this.store.isSucceeded;
  readonly isProcessing: Signal<boolean> = this.store.isProcessing;
  readonly isFailed: Signal<boolean> = this.store.isFailed;

  // ============================================================
  // FALLBACK STATE
  // ============================================================

  readonly hasPendingFallback: Signal<boolean> = this.store.hasPendingFallback;
  readonly isAutoFallbackInProgress: Signal<boolean> = this.store.isAutoFallbackInProgress;
  readonly isFallbackExecuting: Signal<boolean> = this.store.isFallbackExecuting;
  readonly isAutoFallback: Signal<boolean> = this.store.isAutoFallback;
  readonly pendingFallbackEvent: Signal<FallbackAvailableEvent | null> =
    this.store.pendingFallbackEvent;
  readonly fallbackState: Signal<FallbackState> = computed(() => this.store.fallback());

  // ============================================================
  // HISTORY
  // ============================================================

  readonly historyCount: Signal<number> = this.store.historyCount;
  readonly lastHistoryEntry: Signal<PaymentHistoryEntry | null> = this.store.lastHistoryEntry;
  readonly history: Signal<PaymentHistoryEntry[]> = computed(() => this.store.history());

  // ============================================================
  // DEBUG
  // ============================================================

  readonly debugSummary: Signal<PaymentDebugSummary> = this.store.debugSummary;

  getSnapshot(): Readonly<PaymentsState> {
    return this.state();
  }

  subscribe(listener: () => void): Unsubscribe {
    const ref = effect(() => {
      this.state();
      listener();
    });

    return () => ref.destroy();
  }

  // ============================================================
  // ACCIONES DE PAGO
  // ============================================================

  startPayment(
    request: CreatePaymentRequest,
    providerId: PaymentProviderId,
    context?: StrategyContext,
  ): void {
    this.store['startPayment']({ request, providerId, context });
  }

  confirmPayment(request: ConfirmPaymentRequest, providerId: PaymentProviderId): void {
    this.store['confirmPayment']({ request, providerId });
  }

  cancelPayment(request: CancelPaymentRequest, providerId: PaymentProviderId): void {
    this.store['cancelPayment']({ request, providerId });
  }

  refreshPayment(request: GetPaymentStatusRequest, providerId: PaymentProviderId): void {
    this.store['refreshPayment']({ request, providerId });
  }

  selectProvider(providerId: PaymentProviderId): void {
    this.store['selectProvider'](providerId);
  }

  clearError(): void {
    this.store['clearError']();
  }

  reset(): void {
    this.store['reset']();
  }

  clearHistory(): void {
    this.store['clearHistory']();
  }

  executeFallback(providerId: PaymentProviderId): void {
    this.store['executeFallback'](providerId);
  }

  cancelFallback(): void {
    this.store['cancelFallback']();
  }
}
