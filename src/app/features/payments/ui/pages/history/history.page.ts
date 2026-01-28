import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { deepComputed } from '@ngrx/signals';
import { PaymentHistoryFacade } from '@payments/application/api/facades/payment-history.facade';
import type { PaymentHistoryEntry } from '@payments/application/orchestration/store/history/payment-store.history.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ACTION_REQUIRED_STATUSES } from '@payments/ui/shared/ui.types';

import { PaymentIntentCardComponent } from '../../components/payment-intent-card/payment-intent-card.component';

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

  historyLabels = deepComputed(() => ({
    paymentHistoryLabel: this.i18n.t(I18nKeys.ui.payment_history),
    paymentsInSessionText: this.i18n.t(I18nKeys.ui.payments_in_session),
    clearHistoryText: this.i18n.t(I18nKeys.ui.clear_history),
    newPaymentButtonText: this.i18n.t(I18nKeys.ui.new_payment_button),
    noPaymentsHistoryText: this.i18n.t(I18nKeys.ui.no_payments_history),
    paymentsWillAppearText: this.i18n.t(I18nKeys.ui.payments_will_appear),
    makePaymentText: this.i18n.t(I18nKeys.ui.make_payment),
    checkByIdText: this.i18n.t(I18nKeys.ui.check_by_id),
    checkoutLabel: this.i18n.t(I18nKeys.ui.checkout),
  }));
}
