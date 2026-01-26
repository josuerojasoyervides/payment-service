import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { PaymentHistoryFacade } from '@payments/application/facades/payment-history.facade';
import { PaymentHistoryEntry } from '@payments/application/store/payment-store.history.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ACTION_REQUIRED_STATUSES } from '@payments/ui/shared/ui.types';

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
  private readonly historyFacade = inject(PaymentHistoryFacade);
  private readonly i18n = inject(I18nService);

  readonly history = this.historyFacade.history;
  readonly historyCount = this.historyFacade.historyCount;
  readonly isLoading = this.historyFacade.isLoading;

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
    this.historyFacade.confirmPayment(intentId, provider);
  }

  cancelPayment(intentId: string, provider: PaymentProviderId): void {
    this.historyFacade.cancelPayment(intentId, provider);
  }

  refreshPayment(intentId: string, provider: PaymentProviderId): void {
    this.historyFacade.refreshPayment(intentId, provider);
  }

  clearHistory(): void {
    this.historyFacade.clearHistory();
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
