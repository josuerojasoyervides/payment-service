import type { Signal } from '@angular/core';
import { computed, effect, inject, Injectable } from '@angular/core';
import type { PaymentsState } from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import { deepComputed } from '@ngrx/signals';
import type {
  PaymentDebugSummary,
  PaymentStorePort,
  Unsubscribe,
} from '@payments/application/api/ports/payment-store.port';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import { PaymentsStore } from '@payments/application/orchestration/store/payment-store';
import type { FallbackAvailableEvent } from '@payments/domain/subdomains/fallback/contracts/fallback-event.event';
import type { FallbackState } from '@payments/domain/subdomains/fallback/contracts/fallback-state.types';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/subdomains/payment/contracts/payment-request.command';

/**
 * Adapter implementing PaymentStorePort by delegating to PaymentsStore.
 *
 * Decouples UI from the concrete store; UI depends only on the port. Config wires
 * PAYMENT_STATE to this adapter (e.g. in payment.providers).
 */
@Injectable()
export class NgRxSignalsStateAdapter implements PaymentStorePort {
  private readonly store = inject(PaymentsStore);

  // ============================================================
  // REACTIVE STATE (delegated to store)
  // ============================================================

  readonly state: Signal<PaymentsState> = deepComputed(() => ({
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
