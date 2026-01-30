import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentFlowMachineDriver } from '@app/features/payments/application/orchestration/flow/payment-flow-machine-driver';
import { I18nKeys, I18nService } from '@core/i18n';
import { deepComputed, patchState, signalState } from '@ngrx/signals';
import type { NextAction } from '@payments/domain/subdomains/payment/contracts/payment-action.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { PAYMENT_PROVIDER_IDS } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { NextActionCardComponent } from '@payments/ui/components/next-action-card/next-action-card.component';
import { PaymentIntentCardComponent } from '@payments/ui/components/payment-intent-card/payment-intent-card.component';
import { ProviderSelectorComponent } from '@payments/ui/components/provider-selector/provider-selector.component';
import { renderPaymentError } from '@payments/ui/shared/render-payment-errors';

interface StatusPageState {
  intentId: string;
  providerIds: PaymentProviderId[];
  selectedProvider: PaymentProviderId;
  lastQuery: { provider: PaymentProviderId; id: string } | null;
}

/**
 * Page to query payment status by ID.
 *
 * Allows entering an Intent ID (from Stripe or PayPal) and
 * querying its current status, with options to confirm,
 * cancel or refresh.
 */
@Component({
  selector: 'app-status',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PaymentIntentCardComponent,
    NextActionCardComponent,
    ProviderSelectorComponent,
  ],
  templateUrl: './status.component.html',
})
export class StatusComponent {
  private readonly flow = inject(PaymentFlowMachineDriver);
  private readonly i18n = inject(I18nService);

  readonly statusPageState = signalState<StatusPageState>({
    intentId: '',
    providerIds: [...PAYMENT_PROVIDER_IDS],
    selectedProvider: PAYMENT_PROVIDER_IDS[0],
    lastQuery: null,
  });

  readonly flowState = deepComputed(() => ({
    intent: this.flow.intent(),
    error: this.flow.error(),
    isLoading: this.flow.isLoading(),
  }));

  readonly examples = computed(() => [
    {
      id: 'pi_fake_abc123',
      label: this.i18n.t(I18nKeys.ui.stripe_intent),
      provider: 'stripe' as const,
    },
    {
      id: 'ORDER_FAKE_XYZ789',
      label: this.i18n.t(I18nKeys.ui.paypal_order),
      provider: 'paypal' as const,
    },
  ]);

  readonly result = computed(() => {
    const q = this.statusPageState.lastQuery();
    const intent = this.flowState.intent();
    if (!q) return null;
    if (!intent) return null;

    const sameId = intent.id === q.id;
    const sameProvider = intent.provider === q.provider;
    return sameId && sameProvider ? intent : null;
  });

  private didPrefill = false;

  constructor() {
    effect(() => {
      if (this.didPrefill) return;

      const intent = this.flowState.intent();
      if (!intent) return;

      // ✅ No pises si el usuario ya escribió algo o ya buscó algo
      const userTypedSomething = this.statusPageState.intentId().trim().length > 0;
      const alreadyHasQuery = this.statusPageState.lastQuery() !== null;

      if (userTypedSomething || alreadyHasQuery) {
        this.didPrefill = true; // "ya no vuelvas a intentar"
        return;
      }

      this.didPrefill = true;

      patchState(this.statusPageState, {
        intentId: intent.id,
        selectedProvider: intent.provider,
        lastQuery: { provider: intent.provider, id: intent.id },
      });
    });
  }

  searchIntent(): void {
    const id = this.statusPageState.intentId().trim();
    if (!id) return;

    patchState(this.statusPageState, {
      intentId: id, // opcional: normalizas el input
      lastQuery: { provider: this.statusPageState.selectedProvider(), id },
    });

    this.flow.refresh(this.statusPageState.selectedProvider(), id);
  }

  confirmPayment(_intentId: string): void {
    this.flow.confirm();
  }

  onNextActionRequested(action: NextAction): void {
    this.flow.performNextAction(action);
  }

  cancelPayment(_intentId: string): void {
    this.flow.cancel();
  }

  refreshPayment(intentId: string): void {
    patchState(this.statusPageState, {
      lastQuery: { provider: this.statusPageState.selectedProvider(), id: intentId },
    });

    this.flow.refresh(this.statusPageState.selectedProvider(), intentId);
  }

  useExample(example: { id: string; provider: PaymentProviderId }): void {
    patchState(this.statusPageState, {
      intentId: example.id,
      selectedProvider: example.provider,
    });

    this.searchIntent();
  }

  selectProvider(provider: PaymentProviderId): void {
    patchState(this.statusPageState, { selectedProvider: provider });
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

  // Guards
  //Suggest a name for this guard
  readonly canSearch = computed(
    () => !this.statusPageState.intentId() || this.flowState.isLoading(),
  );

  readonly labels = deepComputed(() => ({
    consultStatusTitle: this.i18n.t(I18nKeys.ui.consult_status),
    enterPaymentIdText: this.i18n.t(I18nKeys.ui.enter_payment_id),
    intentIdLabel: this.i18n.t(I18nKeys.ui.intent_id),
    intentIdPlaceholder: this.i18n.t(I18nKeys.ui.intent_id_placeholder),
    exampleStripeText: this.i18n.t(I18nKeys.ui.example_stripe),
    consultingLabel: this.i18n.t(I18nKeys.ui.consulting),
    checkStatusLabel: this.i18n.t(I18nKeys.ui.check_status),
    errorConsultingLabel: this.i18n.t(I18nKeys.ui.error_consulting),
    resultLabel: this.i18n.t(I18nKeys.ui.result),
    quickExamplesLabel: this.i18n.t(I18nKeys.ui.quick_examples),
    checkoutLabel: this.i18n.t(I18nKeys.ui.checkout),
    historyLabel: this.i18n.t(I18nKeys.ui.view_history),
  }));
}
