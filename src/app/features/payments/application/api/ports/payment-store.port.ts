import type { Signal } from '@angular/core';
import type {
  PaymentFlowStatus,
  PaymentsState,
} from '@app/features/payments/application/orchestration/store/types/payment-store-state';
import type { FieldRequirements } from '@app/features/payments/domain/common/entities/field-requirement.model';
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
  readonly historyCount: Signal<number>;
  readonly lastHistoryEntry: Signal<PaymentHistoryEntry | null>;
  readonly history: Signal<PaymentHistoryEntry[]>;
  readonly debugSummary: Signal<PaymentDebugSummary>;

  // Debug (dev-only UI)
  readonly debugStateNode: Signal<string | null>;
  readonly debugTags: Signal<string[]>;
  readonly debugLastEventType: Signal<string | null>;
  readonly debugLastEventPayload: Signal<unknown | null>;

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
export interface PaymentStorePort extends PaymentFlowPort, PaymentCheckoutCatalogPort {}
