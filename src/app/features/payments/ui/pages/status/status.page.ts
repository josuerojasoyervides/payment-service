import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { renderPaymentError } from '@payments/ui/shared/render-payment-errors';

import { NextActionCardComponent } from '../../components/next-action-card/next-action-card.component';
import { PaymentIntentCardComponent } from '../../components/payment-intent-card/payment-intent-card.component';

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
  ],
  templateUrl: './status.component.html',
})
export class StatusComponent {
  private readonly flow = inject(PaymentFlowFacade);
  private readonly i18n = inject(I18nService);

  intentId = '';
  readonly selectedProvider = signal<PaymentProviderId>('stripe');
  readonly result = signal<PaymentIntent | null>(null);
  readonly error = this.flow.error;
  readonly isLoading = this.flow.isLoading;

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

  constructor() {
    effect(() => {
      const intent = this.flow.intent();
      if (intent) this.result.set(intent);
    });
  }

  searchIntent(): void {
    if (!this.intentId.trim()) return;

    this.result.set(null);

    this.flow.refresh(this.selectedProvider(), this.intentId.trim());
  }

  confirmPayment(_intentId: string): void {
    this.flow.confirm();
  }

  cancelPayment(_intentId: string): void {
    this.flow.cancel();
  }

  refreshPayment(intentId: string): void {
    this.flow.refresh(this.selectedProvider(), intentId);
  }

  useExample(example: { id: string; provider: PaymentProviderId }): void {
    this.intentId = example.id;
    this.selectedProvider.set(example.provider);
  }

  getErrorMessage(error: unknown): string {
    return renderPaymentError(this.i18n, error);
  }

  readonly labels = {
    consultStatusTitle: computed(() => this.i18n.t(I18nKeys.ui.consult_status)),
    enterPaymentIdText: computed(() => this.i18n.t(I18nKeys.ui.enter_payment_id)),
    intentIdLabel: computed(() => this.i18n.t(I18nKeys.ui.intent_id)),
    intentIdPlaceholder: computed(() => this.i18n.t(I18nKeys.ui.intent_id_placeholder)),
    exampleStripeText: computed(() => this.i18n.t(I18nKeys.ui.example_stripe)),
    providerLabel: computed(() => this.i18n.t(I18nKeys.ui.provider)),
    stripeProviderLabel: computed(() => this.i18n.t(I18nKeys.ui.provider_stripe)),
    paypalProviderLabel: computed(() => this.i18n.t(I18nKeys.ui.provider_paypal)),
    consultingLabel: computed(() => this.i18n.t(I18nKeys.ui.consulting)),
    checkStatusLabel: computed(() => this.i18n.t(I18nKeys.ui.check_status)),
    errorConsultingLabel: computed(() => this.i18n.t(I18nKeys.ui.error_consulting)),
    resultLabel: computed(() => this.i18n.t(I18nKeys.ui.result)),
    quickExamplesLabel: computed(() => this.i18n.t(I18nKeys.ui.quick_examples)),
    checkoutLabel: computed(() => this.i18n.t(I18nKeys.ui.checkout)),
    historyLabel: computed(() => this.i18n.t(I18nKeys.ui.view_history)),
  };
}
