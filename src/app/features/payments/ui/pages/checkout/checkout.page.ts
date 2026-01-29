import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, isDevMode } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { deepComputed, patchState, signalState } from '@ngrx/signals';
import type { StrategyContext } from '@payments/application/api/ports/payment-strategy.port';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory.registry';
import { FallbackOrchestratorService } from '@payments/application/orchestration/services/fallback-orchestrator.service';
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
    NextActionCardComponent,
    FallbackModalComponent,
  ],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  readonly isDevMode = isDevMode();

  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(I18nService);
  private readonly fallback = inject(FallbackOrchestratorService);
  private readonly flow = inject(PaymentFlowFacade);

  readonly flowState = deepComputed(() => ({
    isLoading: this.flow.isLoading(),
    isReady: this.flow.isReady(),
    hasError: this.flow.hasError(),
    currentIntent: this.flow.intent(),
    currentError: this.flow.error(),
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

  // TODO : Should this be a global state or should be handled by the state machine?
  readonly fallbackState = deepComputed(() => ({
    isPending: this.fallback.isPending(),
    pendingEvent: this.fallback.pendingEvent(),
  }));

  readonly availableProviders = computed<PaymentProviderId[]>(() => {
    return this.registry.getAvailableProviders();
  });

  readonly availableMethods = computed<PaymentMethodType[]>(() => {
    const provider = this.checkoutPageState.selectedProvider();
    if (!provider) return [];

    try {
      return this.registry.get(provider).getSupportedMethods();
    } catch (e) {
      if (this.isDevMode)
        this.logger.warn('Failed to resolve methods', 'CheckoutPage', { provider, e });
      return [];
    }
  });

  readonly fieldRequirements = computed<FieldRequirements | null>(() => {
    const provider = this.checkoutPageState.selectedProvider();
    const method = this.checkoutPageState.selectedMethod();
    if (!provider || !method) return null;
    try {
      const factory = this.registry.get(provider);
      return factory.getFieldRequirements(method);
    } catch (e) {
      if (this.isDevMode) {
        this.logger.warn('Failed to resolve field requirements', 'CheckoutPage', {
          provider,
          method,
          e,
        });
      }
      return null;
    }
  });

  readonly showResult = computed(() => this.flowState.isReady() || this.flowState.hasError());

  readonly debugInfo = computed(() => {
    const snap = this.flow.snapshot();

    return {
      state: snap.value,
      providerId: snap.context.providerId,
      intentId: snap.context.intentId ?? snap.context.intent?.id ?? null,
      tags: snap.tags ? Array.from(snap.tags) : [],
      lastEvent: this.flow.lastSentEvent(),
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
        patchState(this.checkoutPageState, { selectedProvider: providers[0] });
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
    patchState(this.checkoutPageState, {
      selectedProvider: provider,
    });
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
      const factory = this.registry.get(provider);
      const builder = factory.createRequestBuilder(method);

      const options = this.checkoutPageState.formOptions();

      const request = builder
        .forOrder(this.checkoutPageState.orderId())
        .withAmount(this.checkoutPageState.amount(), this.checkoutPageState.currency())
        .withOptions(options)
        .build();

      this.logger.info('Payment request built', 'CheckoutPage', {
        orderId: request.orderId,
        amount: request.amount,
        method: request.method.type,
      });

      // Construir PaymentFlowContext
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

      const ok = this.flow.start(provider, request, context);

      if (!ok) {
        this.logger.warn('START event ignored by machine', 'CheckoutPage', {
          provider,
          method,
        });
      }
    } catch (error) {
      this.logger.error('Failed to build payment request', 'CheckoutPage', error);
    }

    this.logger.endCorrelation(correlationCtx);
  }

  // === Fallback handlers ===
  confirmFallback(provider: PaymentProviderId): void {
    this.logger.info('Fallback confirmed', 'CheckoutPage', { provider });
    const event = this.fallbackState.pendingEvent();
    if (!event) return;

    this.fallback.respondToFallback({
      eventId: event.eventId,
      accepted: true,
      selectedProvider: provider,
      timestamp: Date.now(),
    });
  }

  cancelFallback(): void {
    this.logger.info('Fallback cancelled', 'CheckoutPage');
    const event = this.fallbackState.pendingEvent();
    if (event) {
      this.fallback.respondToFallback({
        eventId: event.eventId,
        accepted: false,
        timestamp: Date.now(),
      });
      return;
    }

    this.fallback.reset();
  }

  onNextActionRequested(action: NextAction): void {
    const ok = this.flow.performNextAction(action);
    if (!ok) {
      this.logger.warn('NEXT_ACTION ignored', 'CheckoutPage', { kind: action.kind });
    }
  }
  confirmPayment(): void {
    const ok = this.flow.confirm();
    if (!ok) this.logger.warn('CONFIRM ignored', 'CheckoutPage');
  }

  cancelPayment(): void {
    const ok = this.flow.cancel();
    if (!ok) this.logger.warn('CANCEL ignored', 'CheckoutPage');
  }

  resetPayment(): void {
    this.flow.reset();

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
