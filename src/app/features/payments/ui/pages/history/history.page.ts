import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentProviderId, PaymentIntent } from '../../../domain/models';
import { PaymentIntentCardComponent } from '../../components';
import { PaymentHistoryEntry } from '../../../application/store/payment.models';
import { I18nService, I18nKeys } from '@core/i18n';

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

  isActionRequired(status: string): boolean {
    return ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(status);
  }

  entryToIntent(entry: PaymentHistoryEntry): PaymentIntent {
    return {
      id: entry.intentId,
      provider: entry.provider,
      status: entry.status as PaymentIntent['status'],
      amount: entry.amount,
      currency: entry.currency as PaymentIntent['currency'],
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

  get paymentHistoryLabel(): string {
    return this.i18n.t(I18nKeys.ui.payment_history);
  }

  get paymentsInSessionText(): string {
    return this.i18n.t(I18nKeys.ui.payments_in_session);
  }

  get clearHistoryText(): string {
    return this.i18n.t(I18nKeys.ui.clear_history);
  }

  get newPaymentButtonText(): string {
    return this.i18n.t(I18nKeys.ui.new_payment_button);
  }

  get noPaymentsHistoryText(): string {
    return this.i18n.t(I18nKeys.ui.no_payments_history);
  }

  get paymentsWillAppearText(): string {
    return this.i18n.t(I18nKeys.ui.payments_will_appear);
  }

  get makePaymentText(): string {
    return this.i18n.t(I18nKeys.ui.make_payment);
  }

  get checkByIdText(): string {
    return this.i18n.t(I18nKeys.ui.check_by_id);
  }

  get checkoutLabel(): string {
    return this.i18n.t(I18nKeys.ui.checkout);
  }
}
