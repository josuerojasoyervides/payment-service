import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, isDevMode } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { deepComputed, patchState, signalState } from '@ngrx/signals';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import type { NextAction } from '@payments/domain/subdomains/payment/contracts/payment-action.types';
import type {
  CurrencyCode,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type {
  FieldRequirements,
  PaymentOptions,
} from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';
import { FallbackModalComponent } from '@payments/ui/components/fallback-modal/fallback-modal.component';
import { FlowDebugPanelComponent } from '@payments/ui/components/flow-debug-panel/flow-debug-panel.component';
import { MethodSelectorComponent } from '@payments/ui/components/method-selector/method-selector.component';
import { NextActionCardComponent } from '@payments/ui/components/next-action-card/next-action-card.component';
import { OrderSummaryComponent } from '@payments/ui/components/order-summary/order-summary.component';
import { PaymentButtonComponent } from '@payments/ui/components/payment-button/payment-button.component';
import { PaymentFormComponent } from '@payments/ui/components/payment-form/payment-form.component';
import { PaymentResultComponent } from '@payments/ui/components/payment-result/payment-result.component';
import { ProviderSelectorComponent } from '@payments/ui/components/provider-selector/provider-selector.component';

interface CheckoutPageState {
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  selectedProvider: PaymentProviderId | null;
  selectedMethod: PaymentMethodType | null;
  formOptions: PaymentOptions;
  isFormValid: boolean;
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
  ],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  readonly isDevMode = isDevMode();

  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(I18nService);
  private readonly state = inject(PAYMENT_STATE);
  private readonly catalog = inject(PAYMENT_CHECKOUT_CATALOG);

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

  readonly fallbackState = deepComputed(() => ({
    isPending: this.state.hasPendingFallback(),
    pendingEvent: this.state.pendingFallbackEvent(),
  }));

  readonly availableProviders = computed<PaymentProviderId[]>(() => {
    return this.catalog.availableProviders();
  });

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

  readonly showResult = computed(() => this.flowState.isReady() || this.flowState.hasError());

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
    effect(() => {
      const providers = this.availableProviders();
      const current = this.checkoutPageState.selectedProvider();

      if (providers.length === 0) {
        if (current !== null) patchState(this.checkoutPageState, { selectedProvider: null });
        return;
      }

      if (!current || !providers.includes(current)) {
        const first = providers[0];
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
      const event = this.fallbackState.pendingEvent();
      if (event) {
        this.logger.info('Fallback available', 'CheckoutPage', {
          failedProvider: event.failedProvider,
          alternatives: event.alternativeProviders,
        });
      }
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
        amount: request.amount,
        method: request.method.type,
      });

      const context: StrategyContext = {
        returnUrl: this.buildReturnUrl(),
        cancelUrl: this.buildCancelUrl(),
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
  }));

  // TODO : This is orchestration layer responsibility, not UI layer
  private buildReturnUrl(): string {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/payments/return`;
  }

  private buildCancelUrl(): string {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/payments/cancel`;
  }
}
