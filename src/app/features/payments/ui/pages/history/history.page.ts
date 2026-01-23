import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ACTION_REQUIRED_STATUSES } from '@payments/ui/shared/ui.types';

import { PaymentHistoryEntry } from '../../../application/store/payment.models';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentIntentCardComponent } from '../../components/payment-intent-card/payment-intent-card.component';

type IntentStatus = PaymentIntent['status'];

/**
 * Payment history page.
 *
 * Shows all payment attempts made during the session.
 * Allows viewing details, refreshing states and performing actions.
 */
@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink, PaymentIntentCardComponent],
  templateUrl: './history.component.html',
})
export class HistoryComponent {
  private readonly paymentState = inject(PAYMENT_STATE);
  private readonly i18n = inject(I18nService);

  readonly history = this.paymentState.history;
  readonly historyCount = this.paymentState.historyCount;
  readonly isLoading = this.paymentState.isLoading;

  isActionRequired(status: PaymentIntent['status']): boolean {
    return ACTION_REQUIRED_STATUSES.has(status);
  }

  entryToIntent(entry: PaymentHistoryEntry): PaymentIntent {
    return {
      id: entry.intentId,
      provider: entry.provider,
      status: entry.status,
      amount: entry.amount,
      currency: entry.currency,
    };
  }

  confirmPayment(intentId: string, provider: PaymentProviderId): void {
    this.paymentState.confirmPayment({ intentId }, provider);
  }

  cancelPayment(intentId: string, provider: PaymentProviderId): void {
    this.paymentState.cancelPayment({ intentId }, provider);
  }

  refreshPayment(intentId: string, provider: PaymentProviderId): void {
    this.paymentState.refreshPayment({ intentId }, provider);
  }

  clearHistory(): void {
    this.paymentState.clearHistory();
  }

  readonly paymentHistoryLabel = computed(() => this.i18n.t(I18nKeys.ui.payment_history));

  readonly paymentsInSessionText = computed(() => this.i18n.t(I18nKeys.ui.payments_in_session));

  readonly clearHistoryText = computed(() => this.i18n.t(I18nKeys.ui.clear_history));

  readonly newPaymentButtonText = computed(() => this.i18n.t(I18nKeys.ui.new_payment_button));

  readonly noPaymentsHistoryText = computed(() => this.i18n.t(I18nKeys.ui.no_payments_history));

  readonly paymentsWillAppearText = computed(() => this.i18n.t(I18nKeys.ui.payments_will_appear));

  readonly makePaymentText = computed(() => this.i18n.t(I18nKeys.ui.make_payment));

  readonly checkByIdText = computed(() => this.i18n.t(I18nKeys.ui.check_by_id));

  readonly checkoutLabel = computed(() => this.i18n.t(I18nKeys.ui.checkout));
}
