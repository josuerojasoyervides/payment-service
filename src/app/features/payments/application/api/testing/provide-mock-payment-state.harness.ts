// src/testing/payments/mock-payment-state.ts
import type { Provider } from '@angular/core';
import { computed, effect, signal } from '@angular/core';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type {
  CurrencyCode,
  PaymentIntent,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  PaymentDebugSummary,
  PaymentStorePort,
  ProviderDescriptor,
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
  // resume selectors (mockeable for UI tests)
  resumeProviderId?: PaymentProviderId | null;
  resumeIntentId?: string | null;
  // debug (dev-only UI)
  debugStateNode?: string | null;
  debugTags?: string[];
  debugLastEventType?: string | null;
  debugLastEventPayload?: unknown | null;
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

  const requiresUserAction = computed(() => {
    const i = intent();
    const action = i?.nextAction;
    const actionable = action ? action.kind !== 'external_wait' : false;
    return i?.status === 'requires_action' || actionable;
  });
  const isSucceeded = computed(() => intent()?.status === 'succeeded');
  const isProcessing = computed(() => intent()?.status === 'processing');
  const isFailed = computed(() => intent()?.status === 'failed');

  const resumeProviderId = signal<PaymentProviderId | null>(overrides.resumeProviderId ?? null);
  const resumeIntentId = signal<string | null>(overrides.resumeIntentId ?? null);
  const canResume = computed(() => !!(resumeProviderId() && resumeIntentId()));

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

  // Debug: defaults are safe (null); overrides can pass sanitized shapes for specs
  const debugStateNode = signal<string | null>(overrides.debugStateNode ?? null);
  const debugTags = signal<string[]>(overrides.debugTags ?? []);
  const debugLastEventType = signal<string | null>(overrides.debugLastEventType ?? null);
  const debugLastEventPayload = signal<unknown | null>(overrides.debugLastEventPayload ?? null);

  // Spy-friendly action fns
  const startPayment = (
    _req: CreatePaymentRequest,
    _provider: PaymentProviderId,
    _ctx?: StrategyContext,
  ) => {};
  const confirmPayment = (_req: ConfirmPaymentRequest, _provider?: PaymentProviderId) => {};
  const cancelPayment = (_req: CancelPaymentRequest, _provider?: PaymentProviderId) => {};
  const refreshPayment = (_req: GetPaymentStatusRequest, _provider?: PaymentProviderId) => {};

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
  const getProviderDescriptors = (): ProviderDescriptor[] => [];
  const getProviderDescriptor = (_providerId: PaymentProviderId): ProviderDescriptor | null => null;
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
    requiresUserAction,
    isSucceeded,
    isProcessing,
    isFailed,
    canResume,
    resumeProviderId,
    resumeIntentId,
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
    debugStateNode,
    debugTags,
    debugLastEventType,
    debugLastEventPayload,

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
    getProviderDescriptors,
    getProviderDescriptor,
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
