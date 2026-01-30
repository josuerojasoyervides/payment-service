import type { Signal } from '@angular/core';
import type {
  PaymentFlowStatus,
  PaymentsState,
} from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';

export type { PaymentHistoryEntry };
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
 * Flow port: state signals, payment/UI/fallback actions, return helpers.
 * UI injects PAYMENT_STATE to get this contract.
 */
export interface PaymentFlowPort {
  readonly state: Signal<PaymentsState>;
  readonly isLoading: Signal<boolean>;
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
  getSnapshot(): Readonly<PaymentsState>;
  subscribe(listener: () => void): Unsubscribe;

  startPayment(
    request: CreatePaymentRequest,
    providerId: PaymentProviderId,
    context?: StrategyContext,
  ): void;
  confirmPayment(request: ConfirmPaymentRequest, providerId?: PaymentProviderId): void;
  cancelPayment(request: CancelPaymentRequest, providerId?: PaymentProviderId): void;
  refreshPayment(request: GetPaymentStatusRequest, providerId?: PaymentProviderId): void;
  selectProvider(providerId: PaymentProviderId): void;
  clearError(): void;
  reset(): void;
  clearHistory(): void;
  executeFallback(providerId: PaymentProviderId): void;
  cancelFallback(): void;

  getReturnReferenceFromQuery(queryParams: Record<string, unknown>): {
    providerId: PaymentProviderId;
    referenceId: string | null;
  };
  notifyRedirectReturned(queryParams: Record<string, unknown>): void;
}

/**
 * Checkout catalog port: providers, methods, field requirements, request builder.
 * UI injects PAYMENT_CHECKOUT_CATALOG for checkout form only.
 */
export interface PaymentCheckoutCatalogPort {
  availableProviders(): PaymentProviderId[];
  getSupportedMethods(providerId: PaymentProviderId): PaymentMethodType[];
  getFieldRequirements(
    providerId: PaymentProviderId,
    method: PaymentMethodType,
  ): FieldRequirements | null;
  buildCreatePaymentRequest(params: {
    providerId: PaymentProviderId;
    method: PaymentMethodType;
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    options: PaymentOptions;
  }): CreatePaymentRequest;
}

/**
 * Combined port for backward compatibility. Prefer injecting PAYMENT_STATE (FlowPort)
 * and PAYMENT_CHECKOUT_CATALOG (CatalogPort) separately in UI.
 */
export interface PaymentStorePort extends PaymentFlowPort, PaymentCheckoutCatalogPort {}
