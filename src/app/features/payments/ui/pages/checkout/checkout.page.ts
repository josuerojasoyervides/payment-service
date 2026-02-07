import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, isDevMode, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { NextAction } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { deepComputed, patchState, signalState } from '@ngrx/signals';
import type { FieldRequirements } from '@payments/application/api/contracts/checkout-field-requirements.types';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { HealthStatus } from '@payments/application/api/ports/provider-health.port';
import { PROVIDER_HEALTH_PORT } from '@payments/application/api/tokens/health/provider-health.token';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { FallbackModalComponent } from '@payments/ui/components/fallback-modal/fallback-modal.component';
import { FallbackStatusBannerComponent } from '@payments/ui/components/fallback-status-banner/fallback-status-banner.component';
import { FlowDebugPanelComponent } from '@payments/ui/components/flow-debug-panel/flow-debug-panel.component';
import { MethodSelectorComponent } from '@payments/ui/components/method-selector/method-selector.component';
import { NextActionCardComponent } from '@payments/ui/components/next-action-card/next-action-card.component';
import { OrderSummaryComponent } from '@payments/ui/components/order-summary/order-summary.component';
import { PaymentButtonComponent } from '@payments/ui/components/payment-button/payment-button.component';
import { PaymentFormComponent } from '@payments/ui/components/payment-form/payment-form.component';
import { PaymentResultComponent } from '@payments/ui/components/payment-result/payment-result.component';
import { ProviderSelectorComponent } from '@payments/ui/components/provider-selector/provider-selector.component';
import { deriveFlowPhase } from '@payments/ui/shared/flow-phase';

interface CheckoutPageState {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  selectedProvider: PaymentProviderId | null;
  selectedMethod: PaymentMethodType | null;
  formOptions: PaymentOptions;
  isFormValid: boolean;
}

interface ProviderHealthState {
  status: HealthStatus['status'] | null;
  latencyMs: number | null;
  isLoading: boolean;
  error: 'timeout' | 'unknown' | null;
}

/**
 * Checkout page for processing payments.
 *
 * This page composes reusable components to create
 * the complete checkout flow:
 * 1. Order summary
 * 2. Provider selection
 * 3. Payment method selection
 * 4. Dynamic form
 * 5. Payment button
 * 6. Result (success/error)
 */
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    OrderSummaryComponent,
    ProviderSelectorComponent,
    MethodSelectorComponent,
    PaymentFormComponent,
    PaymentButtonComponent,
    PaymentResultComponent,
    FlowDebugPanelComponent,
    NextActionCardComponent,
    FallbackModalComponent,
    FallbackStatusBannerComponent,
  ],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  readonly isDevMode = isDevMode();

  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(I18nService);
  readonly state = inject(PAYMENT_STATE);
  private readonly catalog = inject(PAYMENT_CHECKOUT_CATALOG);
  private readonly health = inject(PROVIDER_HEALTH_PORT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(Date.now());
  private healthRequestId = 0;

  readonly flowState = deepComputed(() => ({
    isLoading: this.state.isLoading(),
    isReady: this.state.isReady(),
    hasError: this.state.hasError(),
    currentIntent: this.state.intent(),
    currentError: this.state.error(),
  }));

  readonly checkoutPageState = signalState<CheckoutPageState>({
    orderId: 'order_' + Math.random().toString(36).substring(7),
    amount: 499.99,
    currency: 'MXN',
    selectedProvider: null,
    selectedMethod: null,
    formOptions: {},
    isFormValid: false,
  });

  readonly providerHealthState = signalState<ProviderHealthState>({
    status: null,
    latencyMs: null,
    isLoading: false,
    error: null,
  });

  readonly providerHealthLabel = computed(() => {
    const status = this.providerHealthState.status();
    if (status === 'healthy') return this.checkoutLabels.healthAvailable();
    if (status === 'degraded') return this.checkoutLabels.healthSlow();
    if (status === 'down') return this.checkoutLabels.healthUnavailable();
    return null;
  });

  readonly fallbackState = deepComputed(() => ({
    isPending: this.state.isFallbackConfirming(),
    data: this.state.fallbackConfirmation(),
  }));

  readonly providerDescriptors = computed(() => this.catalog.getProviderDescriptors());

  readonly availableMethods = computed<PaymentMethodType[]>(() => {
    const provider = this.checkoutPageState.selectedProvider();
    if (!provider) return [];
    return this.catalog.getSupportedMethods(provider);
  });

  readonly fieldRequirements = computed<FieldRequirements | null>(() => {
    const provider = this.checkoutPageState.selectedProvider();
    const method = this.checkoutPageState.selectedMethod();
    if (!provider || !method) return null;
    return this.catalog.getFieldRequirements(provider, method);
  });

  readonly flowPhase = deriveFlowPhase(this.state);

  readonly showResult = computed(() => {
    const phase = this.flowPhase();
    // magic strings, should this be a global guard/rule validation?
    return (
      phase === 'action_required' ||
      phase === 'processing' ||
      phase === 'done' ||
      phase === 'failed' ||
      phase === 'fallback_pending' ||
      phase === 'fallback_executing'
    );
  });

  readonly showProcessingPanel = computed(() => this.flowPhase() === 'processing');

  readonly showResumeBanner = computed(
    () => this.flowPhase() === 'editing' && this.state.canResume(),
  );

  readonly showFallbackExecutingBanner = computed(
    () => this.state.isFallbackExecuting() || this.state.isAutoFallbackInProgress(),
  );
  readonly isFallbackExecuting = computed(() => this.state.isFallbackExecuting());
  readonly isAutoFallback = computed(() => this.state.isAutoFallbackInProgress());

  readonly isResilienceBlocked = computed(
    () =>
      this.state.isCircuitOpen() ||
      this.state.isRateLimited() ||
      this.state.isPendingManualReview() ||
      this.state.isAllProvidersUnavailable(),
  );

  readonly showCircuitOpenBanner = computed(() => this.state.isCircuitOpen());
  readonly showCircuitHalfOpenBanner = computed(() => this.state.isCircuitHalfOpen());
  readonly showRateLimitedBanner = computed(() => this.state.isRateLimited());
  readonly showManualReviewPanel = computed(() => this.state.isPendingManualReview());
  readonly showAllProvidersUnavailableModal = computed(() =>
    this.state.isAllProvidersUnavailable(),
  );

  readonly resilienceCountdownSeconds = computed(() => {
    const untilMs = this.state.resilienceCooldownUntilMs();
    if (!untilMs) return null;
    const deltaMs = Math.max(0, untilMs - this.now());
    return Math.ceil(deltaMs / 1000);
  });

  readonly debugInfo = computed(() => {
    const summary = this.state.debugSummary();

    return {
      state: summary.status,
      providerId: summary.provider,
      intentId: summary.intentId,
      tags: [] as string[],
    };
  });

  constructor() {
    const interval = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => clearInterval(interval));

    effect(() => {
      const descriptors = this.providerDescriptors();
      const current = this.checkoutPageState.selectedProvider();

      if (descriptors.length === 0) {
        if (current !== null) patchState(this.checkoutPageState, { selectedProvider: null });
        return;
      }

      if (!current || !descriptors.some((d) => d.id === current)) {
        const first = descriptors[0].id;
        patchState(this.checkoutPageState, { selectedProvider: first });
        this.state.selectProvider(first);
      }
    });

    effect(() => {
      const methods = this.availableMethods();
      const currentMethod = this.checkoutPageState.selectedMethod();
      if (methods.length > 0 && (!currentMethod || !methods.includes(currentMethod))) {
        patchState(this.checkoutPageState, {
          selectedMethod: methods[0],
        });
      }
    });

    effect(() => {
      const provider = this.checkoutPageState.selectedProvider();
      if (!provider) {
        patchState(this.providerHealthState, {
          status: null,
          latencyMs: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      this.refreshProviderHealth(provider);
    });

    effect(() => {
      const data = this.fallbackState.data();
      if (data) {
        this.logger.info('Fallback available', 'CheckoutPage', {
          alternatives: data.eligibleProviders,
          failureReason: data.failureReason,
        });
      }
    });
  }

  private async refreshProviderHealth(providerId: PaymentProviderId): Promise<void> {
    const requestId = ++this.healthRequestId;
    patchState(this.providerHealthState, {
      isLoading: true,
      error: null,
    });

    try {
      const result = await this.withTimeout(this.health.check(providerId), 5000);
      if (requestId !== this.healthRequestId) return;
      patchState(this.providerHealthState, {
        status: result.status,
        latencyMs: result.latencyMs ?? null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (requestId !== this.healthRequestId) return;
      patchState(this.providerHealthState, {
        status: 'down',
        latencyMs: null,
        isLoading: false,
        error: error instanceof Error && error.message === 'timeout' ? 'timeout' : 'unknown',
      });
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      promise
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  selectProvider(provider: PaymentProviderId): void {
    patchState(this.checkoutPageState, { selectedProvider: provider });
    this.state.selectProvider(provider);
    this.logger.info('Provider selected', 'CheckoutPage', { provider });
  }

  selectMethod(method: PaymentMethodType): void {
    patchState(this.checkoutPageState, {
      selectedMethod: method,
    });
    this.logger.info('Method selected', 'CheckoutPage', { method });
  }

  onFormChange(options: PaymentOptions): void {
    patchState(this.checkoutPageState, {
      formOptions: options,
    });
  }

  onFormValidChange(valid: boolean): void {
    patchState(this.checkoutPageState, {
      isFormValid: valid,
    });
  }

  processPayment(): void {
    if (this.isResilienceBlocked()) {
      this.logger.info('Payment blocked by resilience state', 'CheckoutPage', {
        status: this.state.resilienceStatus(),
      });
      return;
    }

    const provider = this.checkoutPageState.selectedProvider();
    const method = this.checkoutPageState.selectedMethod();

    if (!provider || !method) return;

    if (!this.checkoutPageState.isFormValid()) {
      this.logger.info('Form invalid, payment blocked', 'CheckoutPage', { provider, method });
      return;
    }

    const correlationCtx = this.logger.startCorrelation('payment-flow', {
      orderId: this.checkoutPageState.orderId(),
      provider,
      method,
    });

    try {
      const options = this.checkoutPageState.formOptions();
      const request = this.catalog.buildCreatePaymentRequest({
        providerId: provider,
        method,
        orderId: this.checkoutPageState.orderId(),
        amount: this.checkoutPageState.amount(),
        currency: this.checkoutPageState.currency(),
        options,
      });

      this.logger.info('Payment request built', 'CheckoutPage', {
        orderId: request.orderId,
        amount: request.money.amount,
        method: request.method.type,
      });

      const context: StrategyContext = {
        isTest: this.isDevMode,
        deviceData: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          screenWidth: typeof window !== 'undefined' ? window.screen.width : undefined,
          screenHeight: typeof window !== 'undefined' ? window.screen.height : undefined,
        },
      };

      this.state.startPayment(request, provider, context);
    } catch (error) {
      this.logger.error('Failed to build payment request', 'CheckoutPage', error);
    }

    this.logger.endCorrelation(correlationCtx);
  }

  confirmFallback(provider: PaymentProviderId): void {
    this.logger.info('Fallback confirmed', 'CheckoutPage', { provider });
    this.state.executeFallback(provider);
  }

  cancelFallback(): void {
    this.logger.info('Fallback cancelled', 'CheckoutPage');
    this.state.cancelFallback();
  }

  onNextActionRequested(action: NextAction): void {
    if (action.kind === 'redirect' && action.url) {
      if (typeof window !== 'undefined') window.location.href = action.url;
      return;
    }
    if (action.kind === 'client_confirm') {
      const intent = this.state.intent();
      const intentId = intent?.id ?? null;
      if (intentId) this.state.confirmPayment({ intentId });
    }
  }

  confirmPayment(): void {
    const intent = this.state.intent();
    const intentId = intent?.id ?? null;
    if (intentId) this.state.confirmPayment({ intentId });
  }

  cancelPayment(): void {
    const intent = this.state.intent();
    const intentId = intent?.id ?? null;
    if (intentId) this.state.cancelPayment({ intentId });
  }

  resumePayment(): void {
    const providerId = this.state.resumeProviderId();
    const rawId = this.state.resumeIntentId();
    if (!providerId || !rawId) return;
    const result = PaymentIntentId.from(rawId);
    if (!result.ok) return;
    this.state.refreshPayment({ intentId: result.value }, providerId);
  }

  resetPayment(): void {
    this.state.reset();

    patchState(this.checkoutPageState, {
      orderId: 'order_' + Math.random().toString(36).substring(7),
      isFormValid: false,
    });

    this.logger.info('Payment reset', 'CheckoutPage');
  }

  readonly checkoutLabels = deepComputed(() => ({
    checkoutTitle: this.i18n.t(I18nKeys.ui.checkout),
    paymentSystemSubtitle: this.i18n.t(I18nKeys.ui.payment_system),
    viewHistoryLabel: this.i18n.t(I18nKeys.ui.view_history),
    checkStatusLabel: this.i18n.t(I18nKeys.ui.check_status),
    showcaseLabel: this.i18n.t(I18nKeys.ui.showcase),
    paymentProviderLabel: this.i18n.t(I18nKeys.ui.payment_provider),
    paymentMethodLabel: this.i18n.t(I18nKeys.ui.payment_method),
    paymentDataLabel: this.i18n.t(I18nKeys.ui.payment_data),
    debugInfoLabel: this.i18n.t(I18nKeys.ui.debug_info),
    providerDebugLabel: this.i18n.t(I18nKeys.ui.provider_debug),
    methodDebugLabel: this.i18n.t(I18nKeys.ui.method_debug),
    formValidLabel: this.i18n.t(I18nKeys.ui.form_valid),
    loadingDebugLabel: this.i18n.t(I18nKeys.ui.loading_debug),
    processingStatusTitle: this.i18n.t(I18nKeys.ui.processing_status_title),
    processingStatusHint: this.i18n.t(I18nKeys.ui.processing_status_hint),
    refreshStatus: this.i18n.t(I18nKeys.ui.refresh_status),
    resumePaymentFound: this.i18n.t(I18nKeys.ui.resume_payment_found),
    resumePaymentAction: this.i18n.t(I18nKeys.ui.resume_payment_action),
    tryAgainLabel: this.i18n.t(I18nKeys.ui.try_again),
    circuitOpenTitle: this.i18n.t(I18nKeys.ui.circuit_open_title),
    circuitOpenHint: this.i18n.t(I18nKeys.ui.circuit_open_hint),
    circuitHalfOpenHint: this.i18n.t(I18nKeys.ui.circuit_half_open_hint),
    rateLimitedTitle: this.i18n.t(I18nKeys.ui.rate_limited_title),
    rateLimitedHint: this.i18n.t(I18nKeys.ui.rate_limited_hint),
    manualReviewTitle: this.i18n.t(I18nKeys.ui.manual_review_title),
    manualReviewHint: this.i18n.t(I18nKeys.ui.manual_review_hint),
    manualReviewAction: this.i18n.t(I18nKeys.ui.manual_review_action),
    allProvidersUnavailableTitle: this.i18n.t(I18nKeys.ui.all_providers_unavailable_title),
    allProvidersUnavailableHint: this.i18n.t(I18nKeys.ui.all_providers_unavailable_hint),
    healthChecking: this.i18n.t(I18nKeys.ui.health_checking),
    healthAvailable: this.i18n.t(I18nKeys.ui.health_available),
    healthSlow: this.i18n.t(I18nKeys.ui.health_slow),
    healthUnavailable: this.i18n.t(I18nKeys.ui.health_unavailable),
  }));

  // Return/cancel URLs are resolved in the orchestration layer.
}
