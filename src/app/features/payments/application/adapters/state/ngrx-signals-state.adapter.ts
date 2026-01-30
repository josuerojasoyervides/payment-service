import type { Signal } from '@angular/core';
import { computed, effect, inject, Injectable } from '@angular/core';
import type { PaymentsState } from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import { deepComputed } from '@ngrx/signals';
import { ExternalEventAdapter } from '@payments/application/adapters/events/external/external-event.adapter';
import { mapReturnQueryToReference } from '@payments/application/adapters/events/external/mappers/payment-flow-return.mapper';
import type {
  PaymentCheckoutCatalogPort,
  PaymentDebugSummary,
  PaymentFlowPort,
  ProviderDescriptor,
  Unsubscribe,
} from '@payments/application/api/ports/payment-store.port';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import { ProviderDescriptorRegistry } from '@payments/application/orchestration/registry/provider-descriptor/provider-descriptor.registry';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import { PaymentsStore } from '@payments/application/orchestration/store/payment-store';
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
 * Adapter implementing PaymentFlowPort and PaymentCheckoutCatalogPort by delegating to PaymentsStore.
 *
 * Config wires PAYMENT_STATE and PAYMENT_CHECKOUT_CATALOG to this single instance (useExisting).
 */
@Injectable()
export class NgRxSignalsStateAdapter implements PaymentFlowPort, PaymentCheckoutCatalogPort {
  private readonly store = inject(PaymentsStore);
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly descriptorRegistry = inject(ProviderDescriptorRegistry);
  private readonly externalEvents = inject(ExternalEventAdapter);

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
    this.store.startPayment({ request, providerId, context });
  }

  /** Resolve providerId: explicit → intent.provider → selectedProvider. Returns null if none. */
  private resolveProviderId(providerId?: PaymentProviderId): PaymentProviderId | null {
    if (providerId) return providerId;
    const intent = this.store.currentIntent();
    if (intent?.provider) return intent.provider;
    const selected = this.store.selectedProvider();
    if (selected) return selected;
    return null;
  }

  private setMissingProviderError(): void {
    this.store.setError({
      code: 'missing_provider',
      messageKey: 'errors.missing_provider',
      raw: undefined,
    });
  }

  confirmPayment(request: ConfirmPaymentRequest, providerId?: PaymentProviderId): void {
    const resolved = this.resolveProviderId(providerId);
    if (!resolved) {
      this.setMissingProviderError();
      return;
    }
    this.store.confirmPayment({ request, providerId: resolved });
  }

  cancelPayment(request: CancelPaymentRequest, providerId?: PaymentProviderId): void {
    const resolved = this.resolveProviderId(providerId);
    if (!resolved) {
      this.setMissingProviderError();
      return;
    }
    this.store.cancelPayment({ request, providerId: resolved });
  }

  refreshPayment(request: GetPaymentStatusRequest, providerId?: PaymentProviderId): void {
    const resolved = this.resolveProviderId(providerId);
    if (!resolved) {
      this.setMissingProviderError();
      return;
    }
    this.store.refreshPayment({ request, providerId: resolved });
  }

  selectProvider(providerId: PaymentProviderId): void {
    this.store.selectProvider(providerId);
  }

  clearError(): void {
    this.store.clearError();
  }

  reset(): void {
    this.store.reset();
  }

  clearHistory(): void {
    this.store.clearHistory();
  }

  executeFallback(providerId: PaymentProviderId): void {
    this.store.executeFallback(providerId);
  }

  cancelFallback(): void {
    this.store.cancelFallback();
  }

  // ============================================================
  // CHECKOUT CATALOG
  // ============================================================

  availableProviders(): PaymentProviderId[] {
    return this.registry.getAvailableProviders();
  }

  getProviderDescriptors(): ProviderDescriptor[] {
    return this.descriptorRegistry.getProviderDescriptors();
  }

  getProviderDescriptor(providerId: PaymentProviderId): ProviderDescriptor | null {
    return this.descriptorRegistry.getProviderDescriptor(providerId);
  }

  getSupportedMethods(providerId: PaymentProviderId): PaymentMethodType[] {
    try {
      return this.registry.get(providerId).getSupportedMethods();
    } catch {
      return [];
    }
  }

  getFieldRequirements(
    providerId: PaymentProviderId,
    method: PaymentMethodType,
  ): FieldRequirements | null {
    try {
      return this.registry.get(providerId).getFieldRequirements(method);
    } catch {
      return null;
    }
  }

  buildCreatePaymentRequest(params: {
    providerId: PaymentProviderId;
    method: PaymentMethodType;
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    options: PaymentOptions;
  }): CreatePaymentRequest {
    const factory = this.registry.get(params.providerId);
    const builder = factory.createRequestBuilder(params.method);
    return builder
      .forOrder(params.orderId)
      .withAmount(params.amount, params.currency)
      .withOptions(params.options)
      .build();
  }

  getReturnReferenceFromQuery(queryParams: Record<string, unknown>): {
    providerId: PaymentProviderId;
    referenceId: string | null;
  } {
    const ref = mapReturnQueryToReference(queryParams);
    return { providerId: ref.providerId, referenceId: ref.referenceId };
  }

  notifyRedirectReturned(queryParams: Record<string, unknown>): void {
    const ref = mapReturnQueryToReference(queryParams);
    if (ref.referenceId) {
      this.externalEvents.redirectReturned({
        providerId: ref.providerId,
        referenceId: ref.referenceId,
      });
    }
  }
}
