import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';
import { FallbackOrchestratorService } from '@payments/application/orchestration/services/fallback-orchestrator.service';
import {
  CurrencyCode,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { FallbackModalComponent } from '@payments/ui/components/fallback-modal/fallback-modal.component';
import { MethodSelectorComponent } from '@payments/ui/components/method-selector/method-selector.component';
import { NextActionCardComponent } from '@payments/ui/components/next-action-card/next-action-card.component';
import { OrderSummaryComponent } from '@payments/ui/components/order-summary/order-summary.component';
import { PaymentButtonComponent } from '@payments/ui/components/payment-button/payment-button.component';
import { PaymentFormComponent } from '@payments/ui/components/payment-form/payment-form.component';
import { PaymentResultComponent } from '@payments/ui/components/payment-result/payment-result.component';
import { ProviderSelectorComponent } from '@payments/ui/components/provider-selector/provider-selector.component';

import { StrategyContext } from '../../../application/api/ports/payment-strategy.port';
import { ProviderFactoryRegistry } from '../../../application/orchestration/registry/provider-factory.registry';
import {
  FieldRequirements,
  PaymentOptions,
} from '../../../domain/ports/payment/payment-request-builder.port';

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

  readonly isLoading = this.flow.isLoading;
  readonly isReady = this.flow.isReady;
  readonly hasError = this.flow.hasError;

  readonly currentIntent = this.flow.intent;
  readonly currentError = this.flow.error;

  readonly orderId = signal('order_' + Math.random().toString(36).substring(7));
  readonly amount = signal(499.99);
  readonly currency = signal<CurrencyCode>('MXN');

  readonly selectedProvider = signal<PaymentProviderId | null>(null);
  readonly selectedMethod = signal<PaymentMethodType | null>(null);

  private readonly formOptions = signal<PaymentOptions>({});
  readonly isFormValid = signal(false);

  readonly hasPendingFallback = this.fallback.isPending;
  readonly pendingFallbackEvent = this.fallback.pendingEvent;

  readonly availableProviders = computed<PaymentProviderId[]>(() => {
    return this.registry.getAvailableProviders();
  });

  readonly availableMethods = computed<PaymentMethodType[]>(() => {
    const provider = this.selectedProvider();
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
    const provider = this.selectedProvider();
    const method = this.selectedMethod();
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

  readonly showResult = computed(() => this.isReady() || this.hasError());

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
      if (providers.length > 0 && !this.selectedProvider()) {
        this.selectedProvider.set(providers[0]);
      }
    });

    effect(() => {
      const methods = this.availableMethods();
      const currentMethod = this.selectedMethod();
      if (methods.length > 0 && (!currentMethod || !methods.includes(currentMethod))) {
        this.selectedMethod.set(methods[0]);
      }
    });

    effect(() => {
      const event = this.pendingFallbackEvent();
      if (event) {
        this.logger.info('Fallback available', 'CheckoutPage', {
          failedProvider: event.failedProvider,
          alternatives: event.alternativeProviders,
        });
      }
    });

    effect(() => {
      const url = this.flow.redirectUrl();
      if (url) this.onPaypalRequested(url);
    });
  }

  selectProvider(provider: PaymentProviderId): void {
    this.selectedProvider.set(provider);
    this.logger.info('Provider selected', 'CheckoutPage', { provider });
  }

  selectMethod(method: PaymentMethodType): void {
    this.selectedMethod.set(method);
    this.logger.info('Method selected', 'CheckoutPage', { method });
  }

  onFormChange(options: PaymentOptions): void {
    this.formOptions.set(options);
  }

  onFormValidChange(valid: boolean): void {
    this.isFormValid.set(valid);
  }

  processPayment(): void {
    const provider = this.selectedProvider();
    const method = this.selectedMethod();

    if (!provider || !method) return;

    if (!this.isFormValid()) {
      this.logger.info('Form invalid, payment blocked', 'CheckoutPage', { provider, method });
      return;
    }

    const correlationCtx = this.logger.startCorrelation('payment-flow', {
      orderId: this.orderId(),
      provider,
      method,
    });

    try {
      const factory = this.registry.get(provider);
      const builder = factory.createRequestBuilder(method);

      const options = this.formOptions();

      const request = builder
        .forOrder(this.orderId())
        .withAmount(this.amount(), this.currency())
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

      /*       this.flow.send({
        type: 'START',
        providerId: provider,
        request,
        flowContext: context,
      }); */

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
    const event = this.pendingFallbackEvent();
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
    const event = this.pendingFallbackEvent();
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

  onPaypalRequested(url: string): void {
    this.logger.info('Redirecting to PayPal', 'CheckoutPage', { url });
    if (typeof window !== 'undefined') {
      window.location.href = url;
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

    this.orderId.set('order_' + Math.random().toString(36).substring(7));
    this.isFormValid.set(false);

    this.logger.info('Payment reset', 'CheckoutPage');
  }

  readonly checkoutTitle = computed(() => this.i18n.t(I18nKeys.ui.checkout));

  readonly paymentSystemSubtitle = computed(() => this.i18n.t(I18nKeys.ui.payment_system));

  readonly viewHistoryLabel = computed(() => this.i18n.t(I18nKeys.ui.view_history));

  readonly checkStatusLabel = computed(() => this.i18n.t(I18nKeys.ui.check_status));

  readonly showcaseLabel = computed(() => this.i18n.t(I18nKeys.ui.showcase));

  readonly paymentProviderLabel = computed(() => this.i18n.t(I18nKeys.ui.payment_provider));

  readonly paymentMethodLabel = computed(() => this.i18n.t(I18nKeys.ui.payment_method));

  readonly paymentDataLabel = computed(() => this.i18n.t(I18nKeys.ui.payment_data));

  readonly debugInfoLabel = computed(() => this.i18n.t(I18nKeys.ui.debug_info));

  readonly providerDebugLabel = computed(() => this.i18n.t(I18nKeys.ui.provider_debug));

  readonly methodDebugLabel = computed(() => this.i18n.t(I18nKeys.ui.method_debug));

  readonly formValidLabel = computed(() => this.i18n.t(I18nKeys.ui.form_valid));

  readonly loadingDebugLabel = computed(() => this.i18n.t(I18nKeys.ui.loading_debug));

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
