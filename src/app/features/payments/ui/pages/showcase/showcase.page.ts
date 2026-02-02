import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { PaymentCheckoutCatalogPort } from '@app/features/payments/application/api/ports/payment-store.port';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import type { FallbackAvailableEvent } from '@app/features/payments/domain/subdomains/fallback/messages/fallback-available.event';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type {
  CurrencyCode,
  PaymentIntent,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { OrderId } from '@payments/domain/common/primitives/ids/order-id.vo';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
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
  private readonly catalog = inject(PAYMENT_CHECKOUT_CATALOG) as PaymentCheckoutCatalogPort;

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

  /** Provider descriptors from catalog (no hardcoded ids). */
  readonly providerDescriptors = computed(() => this.catalog.getProviderDescriptors());

  /** Resolved options for Payment Button provider dropdown (label from catalog). */
  readonly catalogProviderOptions = computed(() =>
    this.providerDescriptors().map((d) => ({
      id: d.id,
      label: this.i18n.t(d.labelKey),
    })),
  );

  /** Catalog entries for display (label, description, icon from descriptors). */
  readonly catalogDisplay = computed(() =>
    this.providerDescriptors().map((d) => ({
      id: d.id,
      label: this.i18n.t(d.labelKey),
      description: d.descriptionKey ? this.i18n.t(d.descriptionKey) : undefined,
      icon: d.icon,
    })),
  );

  /** First and second provider IDs from catalog (for demo state); fallback to p0 if only one. */
  readonly catalogProviderIds = computed(() => {
    const descriptors = this.providerDescriptors();
    const p0 = descriptors[0]?.id ?? null;
    const p1 = descriptors[1]?.id ?? descriptors[0]?.id ?? null;
    return { p0, p1 };
  });

  // Provider Selector state (selected from catalog when null)
  providerSelector = {
    selected: null as PaymentProviderId | null,
    disabled: false,
  };

  constructor() {
    effect(() => {
      const { p0 } = this.catalogProviderIds();
      if (p0 && this.providerSelector.selected == null) this.providerSelector.selected = p0;
      if (p0 && this.paymentButton.provider == null) this.paymentButton.provider = p0;
    });
  }

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
    provider: null as PaymentProviderId | null,
    loading: false,
    disabled: false,
    state: 'idle' as PaymentButtonState,
  };

  // Payment Result state
  paymentResult = {
    showSuccess: true,
  };

  // Sample data (provider from catalog; intent built in computed)
  readonly sampleIntent = computed((): PaymentIntent | null => {
    const { p0 } = this.catalogProviderIds();
    if (!p0) return null;
    const idResult = PaymentIntentId.from('pi_fake_demo123');
    return {
      id: idResult.ok ? idResult.value : { value: 'pi_fake_demo123' },
      provider: p0,
      status: 'succeeded',
      money: { amount: 499.99, currency: 'MXN' },
      clientSecret: 'pi_fake_demo123_secret_xxx',
    };
  });

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

  /** True when catalog has at least one provider (for conditional rendering). */
  readonly hasProviders = computed(() => this.catalogProviderIds().p0 != null);

  // Intent Card state (provider from catalog; status/actions mutable for demo)
  intentCardShowActions = true;
  intentCardExpanded = false;
  intentCardStatus: PaymentIntent['status'] = 'requires_confirmation';
  readonly intentCard = computed(() => {
    const { p0 } = this.catalogProviderIds();
    const idResult = p0 ? PaymentIntentId.from('pi_fake_card_demo') : null;
    const intent: PaymentIntent | null =
      p0 && idResult
        ? {
            id: idResult.ok ? idResult.value : { value: 'pi_fake_card_demo' },
            provider: p0,
            status: this.intentCardStatus,
            money: { amount: 299.99, currency: 'MXN' as CurrencyCode },
          }
        : null;
    return {
      intent,
      showActions: this.intentCardShowActions,
      expanded: this.intentCardExpanded,
    };
  });

  // Fallback Modal (open mutable; event from catalog; null when no providers)
  fallbackModalOpen = false;
  readonly fallbackModalEvent = computed((): FallbackAvailableEvent | null => {
    const { p0, p1 } = this.catalogProviderIds();
    if (!p0) return null;
    const orderIdResult = OrderId.from('order_123');
    return {
      failedProvider: p0,
      error: {
        code: 'provider_error',
        messageKey: I18nKeys.errors.provider_error,
        raw: { source: 'showcase' },
      },
      alternativeProviders: p1 ? [p1] : [],
      originalRequest: {
        orderId: orderIdResult.ok ? orderIdResult.value : { value: 'order_123' },
        money: { amount: 499.99, currency: 'MXN' },
        method: { type: 'card', token: 'tok_xxx' },
      },
      timestamp: Date.now(),
      eventId: 'fb_demo_123',
    };
  });

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
    this.fallbackModalOpen = false;
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
    demoTokensTitle: computed(() => this.i18n.t(I18nKeys.ui.demo_tokens_title)),
    demoTokensCheatsheet: computed(() => this.i18n.t(I18nKeys.ui.demo_tokens_cheatsheet)),
    noProvidersAvailable: computed(() => this.i18n.t(I18nKeys.ui.no_providers_available)),
  };
}
