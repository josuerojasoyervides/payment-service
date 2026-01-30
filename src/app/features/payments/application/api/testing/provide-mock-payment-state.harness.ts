// src/testing/payments/mock-payment-state.ts
import type { Provider } from '@angular/core';
import { computed, effect, signal } from '@angular/core';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type {
  PaymentDebugSummary,
  PaymentStorePort,
} from '@payments/application/api/ports/payment-store.port';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type {
  PaymentFlowStatus,
  PaymentsState,
} from '@payments/application/orchestration/store/types/payment-store-state';
import type { FallbackAvailableEvent } from '@payments/domain/subdomains/fallback/contracts/fallback-event.event';
import type { FallbackState } from '@payments/domain/subdomains/fallback/contracts/fallback-state.types';
import { INITIAL_FALLBACK_STATE } from '@payments/domain/subdomains/fallback/contracts/fallback-state.types';
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

export interface MockPaymentStateOverrides {
  status?: PaymentFlowStatus;
  intent?: PaymentIntent | null;
  error?: PaymentError | null;
  selectedProvider?: PaymentProviderId | null;
  fallback?: FallbackState;
  history?: PaymentHistoryEntry[];

  // convenience flags (optional)
  isLoading?: boolean;
  isReady?: boolean;
  hasError?: boolean;
}

export function createMockPaymentState(
  overrides: MockPaymentStateOverrides = {},
): PaymentStorePort {
  const status = signal<PaymentFlowStatus>(overrides.status ?? 'idle');
  const intent = signal<PaymentIntent | null>(overrides.intent ?? null);
  const error = signal<PaymentError | null>(overrides.error ?? null);
  const selectedProvider = signal<PaymentProviderId | null>(overrides.selectedProvider ?? null);

  const fallbackState = signal<FallbackState>(overrides.fallback ?? INITIAL_FALLBACK_STATE);
  const history = signal<PaymentHistoryEntry[]>(overrides.history ?? []);

  // Optional convenience flags override status if provided
  if (overrides.isLoading) status.set('loading');
  if (overrides.isReady) status.set('ready');
  if (overrides.hasError) status.set('error');

  const state = computed<PaymentsState>(() => ({
    status: status(),
    intent: intent(),
    error: error(),
    selectedProvider: selectedProvider(),
    currentRequest: null,
    fallback: fallbackState(),
    history: history(),
  }));

  const debugSummary = computed<PaymentDebugSummary>(() => ({
    status: state().status,
    intentId: state().intent?.id ?? null,
    provider: state().selectedProvider,
    fallbackStatus: state().fallback.status,
    isAutoFallback: state().fallback.isAutoFallback,
    historyCount: state().history.length,
  }));

  // Derived signals required by the port
  const isLoading = computed(() => status() === 'loading');
  const isReady = computed(() => status() === 'ready');
  const hasError = computed(() => status() === 'error');

  const hasPendingFallback = computed(() => fallbackState().status === 'pending');
  const isAutoFallbackInProgress = computed(() => fallbackState().status === 'auto_executing');
  const isFallbackExecuting = computed(() => {
    const s = fallbackState().status;
    return s === 'executing' || s === 'auto_executing';
  });
  const isAutoFallback = computed(() => fallbackState().isAutoFallback);
  const pendingFallbackEvent = computed<FallbackAvailableEvent | null>(
    () => fallbackState().pendingEvent,
  );

  const historyCount = computed(() => history().length);
  const lastHistoryEntry = computed(() => {
    const list = history();
    return list.length ? list[list.length - 1] : null;
  });

  // Spy-friendly action fns
  const startPayment = (
    _req: CreatePaymentRequest,
    _provider: PaymentProviderId,
    _ctx?: StrategyContext,
  ) => {};
  const confirmPayment = (_req: ConfirmPaymentRequest, _provider: PaymentProviderId) => {};
  const cancelPayment = (_req: CancelPaymentRequest, _provider: PaymentProviderId) => {};
  const refreshPayment = (_req: GetPaymentStatusRequest, _provider: PaymentProviderId) => {};

  const selectProviderFn = (providerId: PaymentProviderId) => selectedProvider.set(providerId);
  const clearError = () => {
    error.set(null);
    if (status() === 'error') status.set('idle');
  };
  const reset = () => {
    status.set('idle');
    intent.set(null);
    error.set(null);
    selectedProvider.set(null);
    fallbackState.set(INITIAL_FALLBACK_STATE);
    history.set([]);
  };
  const clearHistory = () => history.set([]);
  const executeFallback = (_provider: PaymentProviderId) => {};
  const cancelFallback = () => {};

  const availableProviders = (): PaymentProviderId[] => [];
  const getSupportedMethods = (_providerId: PaymentProviderId): PaymentMethodType[] => [];
  const getFieldRequirements = (
    _providerId: PaymentProviderId,
    _method: PaymentMethodType,
  ): FieldRequirements | null => null;
  const buildCreatePaymentRequest = (_params: {
    providerId: PaymentProviderId;
    method: PaymentMethodType;
    orderId: string;
    amount: number;
    currency: CurrencyCode;
    options: PaymentOptions;
  }): CreatePaymentRequest =>
    ({
      orderId: '',
      amount: 0,
      currency: 'MXN',
      method: { type: 'card' },
    }) as CreatePaymentRequest;

  return {
    state,
    isLoading,
    isReady,
    hasError,
    intent,
    error,
    selectedProvider,

    hasPendingFallback,
    isAutoFallbackInProgress,
    isFallbackExecuting,
    isAutoFallback,
    pendingFallbackEvent,
    fallbackState: computed(() => fallbackState()),

    historyCount,
    lastHistoryEntry,
    history,

    debugSummary,

    getSnapshot: () => state(),

    subscribe: (listener) => {
      const ref = effect(() => {
        state();
        listener();
      });
      return () => ref.destroy();
    },

    startPayment,
    confirmPayment,
    cancelPayment,
    refreshPayment,

    selectProvider: selectProviderFn,
    clearError,
    reset,
    clearHistory,

    executeFallback,
    cancelFallback,

    availableProviders,
    getSupportedMethods,
    getFieldRequirements,
    buildCreatePaymentRequest,

    getReturnReferenceFromQuery: (queryParams: Record<string, unknown>) => {
      const token = Array.isArray(queryParams['token'])
        ? queryParams['token'][0]
        : queryParams['token'];
      const pi = queryParams['payment_intent'] ?? queryParams['setup_intent'] ?? null;
      const id = typeof pi === 'string' ? pi : Array.isArray(pi) ? pi[0] : null;
      if (typeof token === 'string' && token)
        return { providerId: 'paypal' as PaymentProviderId, referenceId: token };
      if (id) return { providerId: 'stripe' as PaymentProviderId, referenceId: id };
      return { providerId: 'stripe' as PaymentProviderId, referenceId: null };
    },
    notifyRedirectReturned: () => {},
  };
}

export function provideMockPaymentState(overrides?: MockPaymentStateOverrides): Provider[] {
  const mock = createMockPaymentState(overrides);
  return [
    { provide: PAYMENT_STATE, useValue: mock },
    { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mock },
  ];
}
