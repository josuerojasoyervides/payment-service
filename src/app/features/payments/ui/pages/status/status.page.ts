import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { PaymentCheckoutCatalogPort } from '@app/features/payments/application/api/ports/payment-store.port';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { NextAction } from '@app/features/payments/domain/subdomains/payment/entities/payment-action.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { I18nKeys, I18nService } from '@core/i18n';
import { deepComputed, patchState, signalState } from '@ngrx/signals';
import { FlowDebugPanelComponent } from '@payments/ui/components/flow-debug-panel/flow-debug-panel.component';
import { NextActionCardComponent } from '@payments/ui/components/next-action-card/next-action-card.component';
import { PaymentIntentCardComponent } from '@payments/ui/components/payment-intent-card/payment-intent-card.component';
import { ProviderSelectorComponent } from '@payments/ui/components/provider-selector/provider-selector.component';
import { renderPaymentError } from '@payments/ui/shared/render-payment-errors';

/** Demo intent IDs for quick examples (one per catalog index). No provider names in source. */
const DEMO_INTENT_IDS = ['pi_fake_abc123', 'ORDER_FAKE_XYZ789'];

interface StatusPageState {
  intentId: string;
  lastQueryId: string | null;
}

/**
 * Page to query payment status by ID.
 *
 * Provider-agnostic: reads provider list from catalog, selected provider from state port.
 * On search/refresh, passes providerId explicitly to the port.
 */
@Component({
  selector: 'app-status',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FlowDebugPanelComponent,
    PaymentIntentCardComponent,
    NextActionCardComponent,
    ProviderSelectorComponent,
  ],
  templateUrl: './status.component.html',
})
export class StatusComponent {
  private readonly state = inject(PAYMENT_STATE);
  private readonly i18n = inject(I18nService);
  private readonly catalog = inject(PAYMENT_CHECKOUT_CATALOG) as PaymentCheckoutCatalogPort;

  readonly providerDescriptors = computed(() => this.catalog.getProviderDescriptors());

  readonly statusPageState = signalState<StatusPageState>({
    intentId: '',
    lastQueryId: null,
  });

  /** Selected provider from global port; UI calls state.selectProvider on change. */
  readonly selectedProvider = computed(() => this.state.selectedProvider());

  readonly flowState = deepComputed(() => ({
    intent: this.state.intent(),
    error: this.state.error(),
    isLoading: this.state.isLoading(),
  }));

  /** Quick examples derived from catalog (label from descriptor, id from demo list). */
  readonly examples = computed(() => {
    const descriptors = this.providerDescriptors();
    return descriptors.map((d, i) => ({
      id: DEMO_INTENT_IDS[i] ?? `demo_${i}`,
      label: this.i18n.t(d.labelKey),
      provider: d.id,
    }));
  });

  /** Result: show intent only when it matches the last queried intentId (match by id only). */
  readonly result = computed(() => {
    const lastId = this.statusPageState.lastQueryId();
    const intent = this.flowState.intent();
    if (!lastId || !intent || intent.id !== lastId) return null;
    return intent;
  });

  private didPrefill = false;

  constructor() {
    effect(() => {
      const descriptors = this.providerDescriptors();
      const current = this.state.selectedProvider();
      if (descriptors.length === 0) return;
      if (!current || !descriptors.some((d) => d.id === current)) {
        this.state.selectProvider(descriptors[0].id);
      }
    });

    effect(() => {
      if (this.didPrefill) return;
      const intent = this.flowState.intent();
      if (!intent) return;
      const userTypedSomething = this.statusPageState.intentId().trim().length > 0;
      const alreadyHasQuery = this.statusPageState.lastQueryId() !== null;
      if (userTypedSomething || alreadyHasQuery) {
        this.didPrefill = true;
        return;
      }
      this.didPrefill = true;
      patchState(this.statusPageState, { intentId: intent.id, lastQueryId: intent.id });
      this.state.selectProvider(intent.provider);
    });
  }

  searchIntent(): void {
    const id = this.statusPageState.intentId().trim();
    if (!id) return;
    const descriptors = this.providerDescriptors();
    let providerId = this.state.selectedProvider();
    if (!providerId && descriptors.length > 0) {
      this.state.selectProvider(descriptors[0].id);
      providerId = descriptors[0].id;
    }
    if (!providerId) return;
    patchState(this.statusPageState, { lastQueryId: id });
    this.state.refreshPayment({ intentId: id }, providerId);
  }

  confirmPayment(intentId: string): void {
    this.state.confirmPayment({ intentId });
  }

  onNextActionRequested(action: NextAction): void {
    if (action.kind === 'redirect' && action.url) {
      if (typeof window !== 'undefined') window.location.href = action.url;
      return;
    }
    if (action.kind === 'client_confirm') {
      const intent = this.state.intent();
      const intentId = intent?.id ?? this.statusPageState.lastQueryId() ?? null;
      if (intentId) this.state.confirmPayment({ intentId });
    }
  }

  cancelPayment(intentId: string): void {
    this.state.cancelPayment({ intentId });
  }

  refreshPayment(intentId: string): void {
    const providerId = this.state.selectedProvider();
    if (providerId) {
      patchState(this.statusPageState, { lastQueryId: intentId });
      this.state.refreshPayment({ intentId }, providerId);
    }
  }

  useExample(example: { id: string; provider: PaymentProviderId }): void {
    patchState(this.statusPageState, { intentId: example.id });
    this.state.selectProvider(example.provider);
    this.searchIntent();
  }

  onSelectProvider(provider: PaymentProviderId): void {
    this.state.selectProvider(provider);
  }

  getErrorMessage(error: unknown): string {
    return renderPaymentError(this.i18n, error);
  }

  get intentIdModel(): string {
    return this.statusPageState.intentId();
  }
  set intentIdModel(value: string) {
    patchState(this.statusPageState, { intentId: value });
  }

  readonly isSearchDisabled = computed(
    () => !this.statusPageState.intentId()?.trim() || this.flowState.isLoading(),
  );

  readonly labels = deepComputed(() => ({
    consultStatusTitle: this.i18n.t(I18nKeys.ui.consult_status),
    enterPaymentIdText: this.i18n.t(I18nKeys.ui.enter_payment_id),
    intentIdLabel: this.i18n.t(I18nKeys.ui.intent_id),
    intentIdPlaceholder: this.i18n.t(I18nKeys.ui.intent_id_placeholder),
    exampleIntentHint: this.i18n.t(I18nKeys.ui.example_intent_placeholder),
    consultingLabel: this.i18n.t(I18nKeys.ui.consulting),
    checkStatusLabel: this.i18n.t(I18nKeys.ui.check_status),
    errorConsultingLabel: this.i18n.t(I18nKeys.ui.error_consulting),
    resultLabel: this.i18n.t(I18nKeys.ui.result),
    quickExamplesLabel: this.i18n.t(I18nKeys.ui.quick_examples),
    checkoutLabel: this.i18n.t(I18nKeys.ui.checkout),
    historyLabel: this.i18n.t(I18nKeys.ui.view_history),
  }));
}
