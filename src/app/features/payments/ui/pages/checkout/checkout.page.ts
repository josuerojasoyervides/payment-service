import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, isDevMode, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
// Domain types
import {
  CurrencyCode,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
// Port and token (decoupled from implementation)
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { FieldRequirements, PaymentOptions, StrategyContext } from '../../../domain/ports';
// UI Components
import {
  FallbackModalComponent,
  MethodSelectorComponent,
  NextActionCardComponent,
  OrderSummaryComponent,
  PaymentButtonComponent,
  PaymentFormComponent,
  PaymentResultComponent,
  ProviderSelectorComponent,
} from '../../components';

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

  private readonly paymentState = inject(PAYMENT_STATE);
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(I18nService);

  readonly orderId = signal('order_' + Math.random().toString(36).substring(7));
  readonly amount = signal(499.99);
  readonly currency = signal<CurrencyCode>('MXN');

  readonly selectedProvider = signal<PaymentProviderId | null>(null);
  readonly selectedMethod = signal<PaymentMethodType | null>(null);

  private formOptions = signal<PaymentOptions>({});
  readonly isFormValid = signal(false);

  readonly isLoading = this.paymentState.isLoading;
  readonly isReady = this.paymentState.isReady;
  readonly hasError = this.paymentState.hasError;
  readonly currentIntent = this.paymentState.intent;
  readonly currentError = this.paymentState.error;

  readonly hasPendingFallback = this.paymentState.hasPendingFallback;
  readonly pendingFallbackEvent = this.paymentState.pendingFallbackEvent;

  readonly availableProviders = computed<PaymentProviderId[]>(() => {
    return this.registry.getAvailableProviders();
  });

  readonly availableMethods = computed<PaymentMethodType[]>(() => {
    const provider = this.selectedProvider();
    if (!provider) return [];
    try {
      const factory = this.registry.get(provider);
      return factory.getSupportedMethods();
    } catch {
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
    } catch {
      return null;
    }
  });

  readonly showResult = computed(() => {
    return this.isReady() || this.hasError();
  });

  readonly debugInfo = this.paymentState.debugSummary;

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
  }

  selectProvider(provider: PaymentProviderId): void {
    this.selectedProvider.set(provider);
    this.paymentState.selectProvider(provider);
    this.paymentState.clearError();
    this.logger.info('Provider selected', 'CheckoutPage', { provider });
  }

  selectMethod(method: PaymentMethodType): void {
    this.selectedMethod.set(method);
    this.paymentState.clearError();
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
        isTest: isDevMode(),
        deviceData: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          screenWidth: typeof window !== 'undefined' ? window.screen.width : undefined,
          screenHeight: typeof window !== 'undefined' ? window.screen.height : undefined,
        },
      };

      this.paymentState.startPayment(request, provider, context);
    } catch (error) {
      this.logger.error('Failed to build payment request', 'CheckoutPage', error);
    }

    this.logger.endCorrelation(correlationCtx);
  }

  // === Fallback handlers ===
  confirmFallback(provider: PaymentProviderId): void {
    this.logger.info('Fallback confirmed', 'CheckoutPage', { provider });
    this.paymentState.executeFallback(provider);
  }

  cancelFallback(): void {
    this.logger.info('Fallback cancelled', 'CheckoutPage');
    this.paymentState.cancelFallback();
  }

  onPaypalRequested(url: string): void {
    this.logger.info('Redirecting to PayPal', 'CheckoutPage', { url });
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }

  resetPayment(): void {
    this.paymentState.reset();
    this.orderId.set('order_' + Math.random().toString(36).substring(7));
    this.isFormValid.set(false);
    this.logger.info('Payment reset', 'CheckoutPage');
  }

  get checkoutTitle(): string {
    return this.i18n.t(I18nKeys.ui.checkout);
  }

  get paymentSystemSubtitle(): string {
    return this.i18n.t(I18nKeys.ui.payment_system);
  }

  get viewHistoryLabel(): string {
    return this.i18n.t(I18nKeys.ui.view_history);
  }

  get checkStatusLabel(): string {
    return this.i18n.t(I18nKeys.ui.check_status);
  }

  get showcaseLabel(): string {
    return this.i18n.t(I18nKeys.ui.showcase);
  }

  get paymentProviderLabel(): string {
    return this.i18n.t(I18nKeys.ui.payment_provider);
  }

  get paymentMethodLabel(): string {
    return this.i18n.t(I18nKeys.ui.payment_method);
  }

  get paymentDataLabel(): string {
    return this.i18n.t(I18nKeys.ui.payment_data);
  }

  get debugInfoLabel(): string {
    return this.i18n.t(I18nKeys.ui.debug_info);
  }

  get providerDebugLabel(): string {
    return this.i18n.t(I18nKeys.ui.provider_debug);
  }

  get methodDebugLabel(): string {
    return this.i18n.t(I18nKeys.ui.method_debug);
  }

  get formValidLabel(): string {
    return this.i18n.t(I18nKeys.ui.form_valid);
  }

  get loadingDebugLabel(): string {
    return this.i18n.t(I18nKeys.ui.loading_debug);
  }

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
