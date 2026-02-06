import type { Signal } from '@angular/core';
import type {
  PaymentFlowStatus,
  PaymentsState,
  ResilienceState,
} from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import type { FallbackState } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.model';
import type { FallbackAvailableEvent } from '@app/features/payments/domain/subdomains/fallback/messages/fallback-available.event';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type {
  CurrencyCode,
  PaymentIntent,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { FieldRequirements } from '@payments/application/api/contracts/checkout-field-requirements.types';
import type { RedirectReturnRaw } from '@payments/application/api/contracts/redirect-return.contract';
import type { RedirectReturnedPayload } from '@payments/application/api/contracts/redirect-return-normalized.contract';
import type {
  FallbackConfirmationData,
  ManualReviewData,
} from '@payments/application/api/contracts/resilience.types';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';

export type { PaymentHistoryEntry };

/**
 * Provider metadata for checkout UI (techless: i18n keys are plain strings).
 * Config/infra register one per provider; UI uses labelKey/descriptionKey for translation.
 */
export interface ProviderDescriptor {
  id: PaymentProviderId;
  labelKey: string;
  descriptionKey?: string;
  icon?: string;
  badges?: string[];
  supportedMethods?: PaymentMethodType[];
}

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
 * Core flow port (UI-agnostic): snapshot + imperative actions.
 *
 * UI can build signals/selectors on top of this, but the core port does not
 * depend on framework or presentation types.
 */
export interface PaymentFlowPortCore {
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
}

/**
 * UI flow port: signals, debug helpers, and UI-only helpers.
 * UI injects PAYMENT_STATE to get this contract.
 */
export interface PaymentFlowPortUi extends PaymentFlowPortCore {
  readonly state: Signal<PaymentsState>;
  readonly isLoading: Signal<boolean>;
  readonly isReady: Signal<boolean>;
  readonly hasError: Signal<boolean>;
  readonly intent: Signal<PaymentIntent | null>;
  readonly error: Signal<PaymentError | null>;
  readonly requiresUserAction: Signal<boolean>;
  readonly isSucceeded: Signal<boolean>;
  readonly isProcessing: Signal<boolean>;
  readonly isFailed: Signal<boolean>;
  readonly canResume: Signal<boolean>;
  readonly resumeProviderId: Signal<PaymentProviderId | null>;
  readonly resumeIntentId: Signal<string | null>;
  readonly selectedProvider: Signal<PaymentProviderId | null>;
  readonly hasPendingFallback: Signal<boolean>;
  readonly isAutoFallbackInProgress: Signal<boolean>;
  readonly isFallbackExecuting: Signal<boolean>;
  readonly isAutoFallback: Signal<boolean>;
  readonly pendingFallbackEvent: Signal<FallbackAvailableEvent | null>;
  readonly fallbackState: Signal<FallbackState>;
  readonly resilienceState: Signal<ResilienceState>;
  readonly resilienceStatus: Signal<ResilienceState['status']>;
  readonly resilienceCooldownUntilMs: Signal<number | null>;
  readonly fallbackConfirmation: Signal<FallbackConfirmationData | null>;
  readonly manualReviewData: Signal<ManualReviewData | null>;
  readonly isCircuitOpen: Signal<boolean>;
  readonly isCircuitHalfOpen: Signal<boolean>;
  readonly isRateLimited: Signal<boolean>;
  readonly isFallbackConfirming: Signal<boolean>;
  readonly isPendingManualReview: Signal<boolean>;
  readonly isAllProvidersUnavailable: Signal<boolean>;
  readonly canRetryClientConfirm: Signal<boolean>;
  readonly historyCount: Signal<number>;
  readonly lastHistoryEntry: Signal<PaymentHistoryEntry | null>;
  readonly history: Signal<PaymentHistoryEntry[]>;
  readonly debugSummary: Signal<PaymentDebugSummary>;

  // Debug (dev-only UI)
  readonly debugStateNode: Signal<string | null>;
  readonly debugTags: Signal<string[]>;
  readonly debugLastEventType: Signal<string | null>;
  readonly debugLastEventPayload: Signal<unknown | null>;

  notifyRedirectReturned(raw: RedirectReturnRaw): RedirectReturnedPayload | null;
}

/**
 * Checkout catalog port: providers, methods, field requirements, request builder.
 * UI injects PAYMENT_CHECKOUT_CATALOG for checkout form only.
 */
export interface PaymentCheckoutCatalogPort {
  availableProviders(): PaymentProviderId[];
  getProviderDescriptors(): ProviderDescriptor[];
  getProviderDescriptor(providerId: PaymentProviderId): ProviderDescriptor | null;
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
export interface PaymentStorePort extends PaymentFlowPortUi, PaymentCheckoutCatalogPort {}

/** Backwards-compatible alias; prefer PaymentFlowPortCore or PaymentFlowPortUi explicitly. */
export type PaymentFlowPort = PaymentFlowPortUi;
