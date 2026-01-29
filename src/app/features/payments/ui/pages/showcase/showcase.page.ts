import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import type { FallbackAvailableEvent } from '@payments/domain/subdomains/fallback/contracts/fallback-event.event';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type {
  CurrencyCode,
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { FallbackModalComponent } from '@payments/ui/components/fallback-modal/fallback-modal.component';
import { MethodSelectorComponent } from '@payments/ui/components/method-selector/method-selector.component';
import { OrderSummaryComponent } from '@payments/ui/components/order-summary/order-summary.component';
import { PaymentButtonComponent } from '@payments/ui/components/payment-button/payment-button.component';
import { PaymentIntentCardComponent } from '@payments/ui/components/payment-intent-card/payment-intent-card.component';
import { PaymentResultComponent } from '@payments/ui/components/payment-result/payment-result.component';
import { ProviderSelectorComponent } from '@payments/ui/components/provider-selector/provider-selector.component';
import { SpeiInstructionsComponent } from '@payments/ui/components/spei-instructions/spei-instructions.component';
import type { OrderItem, PaymentButtonState } from '@payments/ui/shared/ui.types';

/**
 * Showcase page to demonstrate all UI components.
 *
 * Lets you view each component in different states and configurations,
 * with interactive controls to tweak their props.
 */
@Component({
  selector: 'app-showcase',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    OrderSummaryComponent,
    ProviderSelectorComponent,
    MethodSelectorComponent,
    PaymentButtonComponent,
    PaymentResultComponent,
    SpeiInstructionsComponent,
    FallbackModalComponent,
    PaymentIntentCardComponent,
  ],
  templateUrl: './showcase.component.html',
})
export class ShowcaseComponent {
  private readonly i18n = inject(I18nService);
  private readonly logger = inject(LoggerService);

  // Order Summary state
  orderSummary = {
    orderId: 'order_demo_123',
    amount: 499.99,
    currency: 'MXN' as CurrencyCode,
    showItems: true,
    items: [
      { name: 'Premium product', quantity: 1, price: 399.99 },
      { name: 'Express shipping', quantity: 1, price: 100.0 },
    ] as OrderItem[],
  };

  // Provider Selector state
  providerSelector = {
    providers: ['stripe', 'paypal'] as PaymentProviderId[],
    selected: 'stripe' as PaymentProviderId,
    disabled: false,
  };

  // Method Selector state
  methodSelector = {
    methods: ['card', 'spei'] as PaymentMethodType[],
    selected: 'card' as PaymentMethodType,
    disabled: false,
  };

  // Payment Button state
  paymentButton = {
    amount: 499.99,
    currency: 'MXN' as CurrencyCode,
    provider: 'stripe' as PaymentProviderId,
    loading: false,
    disabled: false,
    state: 'idle' as PaymentButtonState,
  };

  // Payment Result state
  paymentResult = {
    showSuccess: true,
  };

  // Sample data
  sampleIntent: PaymentIntent = {
    id: 'pi_fake_demo123',
    provider: 'stripe',
    status: 'succeeded',
    amount: 499.99,
    currency: 'MXN',
    clientSecret: 'pi_fake_demo123_secret_xxx',
  };

  sampleError: PaymentError = {
    code: 'card_declined',
    messageKey: I18nKeys.errors.card_declined,
    raw: { originalError: 'card_declined' },
  };

  // SPEI Instructions state
  speiInstructions = {
    clabe: '646180157034567890',
    reference: '1234567',
    bank: 'STP',
    beneficiary: 'Payment Service Demo',
    amount: 499.99,
    currency: 'MXN',
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  };

  // Intent Card state
  intentCard = {
    intent: {
      id: 'pi_fake_card_demo',
      provider: 'stripe' as PaymentProviderId,
      status: 'requires_confirmation' as const,
      amount: 299.99,
      currency: 'MXN' as CurrencyCode,
    } as PaymentIntent,
    showActions: true,
    expanded: false,
  };

  // Fallback Modal state
  fallbackModal = {
    open: false,
    event: {
      failedProvider: 'stripe',
      error: {
        code: 'provider_error',
        messageKey: I18nKeys.errors.provider_error,
        raw: { source: 'showcase' },
      },
      alternativeProviders: ['paypal'],
      originalRequest: {
        orderId: 'order_123',
        amount: 499.99,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_xxx' },
      },
      timestamp: Date.now(),
      eventId: 'fb_demo_123',
    } as FallbackAvailableEvent,
  };

  // Handlers
  onPayClick(): void {
    this.logger.warn('Pay button clicked', 'ShowcaseComponent');
  }

  onRetry(): void {
    this.logger.warn('Retry button clicked', 'ShowcaseComponent');
  }

  onNewPayment(): void {
    this.logger.warn('New payment button clicked', 'ShowcaseComponent');
  }

  onIntentAction(action: string, intentId: string): void {
    this.logger.warn(`Intent action: ${action}, ID: ${intentId}`, 'ShowcaseComponent', {
      action,
      intentId,
    });
  }

  onFallbackConfirm(provider: PaymentProviderId): void {
    this.logger.warn(`Fallback confirmed with: ${provider}`, 'ShowcaseComponent', { provider });
    this.fallbackModal.open = false;
  }

  // ===== Textos para el template =====
  readonly labels = {
    componentShowcaseTitle: computed(() => this.i18n.t(I18nKeys.ui.component_showcase)),
    componentShowcaseDescription: computed(() =>
      this.i18n.t(I18nKeys.ui.component_showcase_description),
    ),
    goToCheckoutLabel: computed(() => this.i18n.t(I18nKeys.ui.go_to_checkout)),
    previewLabel: computed(() => this.i18n.t(I18nKeys.ui.preview)),
    controlsLabel: computed(() => this.i18n.t(I18nKeys.ui.controls)),
    amountLabelShort: computed(() => this.i18n.t(I18nKeys.ui.amount_label_short)),
    currencyLabel: computed(() => this.i18n.t(I18nKeys.ui.currency_label)),
    showItemsBreakdownLabel: computed(() => this.i18n.t(I18nKeys.ui.show_items_breakdown)),
    selectedLabel: computed(() => this.i18n.t(I18nKeys.ui.selected)),
    disabledLabel: computed(() => this.i18n.t(I18nKeys.ui.disabled)),
    providerLabel: computed(() => this.i18n.t(I18nKeys.ui.provider)),
    stripeProviderLabel: computed(() => this.i18n.t(I18nKeys.ui.provider_stripe)),
    paypalProviderLabel: computed(() => this.i18n.t(I18nKeys.ui.provider_paypal)),
    statusLabelShort: computed(() => this.i18n.t(I18nKeys.ui.status_label_short)),
    loadingLabel: computed(() => this.i18n.t(I18nKeys.ui.loading)),
    successLabel: computed(() => this.i18n.t(I18nKeys.ui.success)),
    errorLabel: computed(() => this.i18n.t(I18nKeys.ui.error)),
    showSuccessStateLabel: computed(() => this.i18n.t(I18nKeys.ui.show_success_state)),
    clabeLabel: computed(() => this.i18n.t(I18nKeys.ui.clabe_label)),
    statusRequiresConfirmationLabel: computed(() =>
      this.i18n.t(I18nKeys.messages.status_requires_confirmation),
    ),
    statusRequiresActionLabel: computed(() =>
      this.i18n.t(I18nKeys.messages.status_requires_action),
    ),
    processingLabel: computed(() => this.i18n.t(I18nKeys.ui.processing)),
    statusSucceededLabel: computed(() => this.i18n.t(I18nKeys.messages.status_succeeded)),
    statusFailedLabel: computed(() => this.i18n.t(I18nKeys.messages.status_failed)),
    canceledLabel: computed(() => this.i18n.t(I18nKeys.ui.canceled)),
    showActionsLabel: computed(() => this.i18n.t(I18nKeys.ui.show_actions)),
    expandedLabel: computed(() => this.i18n.t(I18nKeys.ui.expanded)),
    openFallbackModalLabel: computed(() => this.i18n.t(I18nKeys.ui.open_fallback_modal)),
    infoLabel: computed(() => this.i18n.t(I18nKeys.ui.info)),
    fallbackModalInfoLabel: computed(() => this.i18n.t(I18nKeys.ui.fallback_modal_info)),
  };
}
