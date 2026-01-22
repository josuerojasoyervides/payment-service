import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { getStatusText, PaymentIntent, STATUS_BADGE_MAP } from '../../shared/ui.types';

/**
 * Card component to display a PaymentIntent.
 *
 * Useful for history lists, status page, etc.
 * Shows summarized information and optional actions.
 *
 * @example
 * ```html
 * <app-payment-intent-card
 *   [intent]="intent"
 *   [showActions]="true"
 *   [expanded]="false"
 *   (confirm)="onConfirm($event)"
 *   (cancel)="onCancel($event)"
 *   (refresh)="onRefresh($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-payment-intent-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './payment-intent-card.component.html',
})
export class PaymentIntentCardComponent {
  private readonly i18n = inject(I18nService);

  /** Intent to display */
  readonly intent = input.required<PaymentIntent>();

  /** Whether to show actions */
  readonly showActions = input<boolean>(true);

  /** Whether expanded */
  readonly expanded = input<boolean>(false);

  /** Emits to confirm the intent */
  readonly confirm = output<string>();

  /** Emits to cancel the intent */
  readonly canceled = output<string>();

  /** Emits to refresh status */
  readonly refresh = output<string>();

  /** Emits to expand/collapse */
  readonly expandedChange = output<boolean>();

  /** Status helpers */
  readonly isSucceeded = computed(() => this.intent().status === 'succeeded');
  readonly isFailed = computed(() => this.intent().status === 'failed');
  readonly isCanceled = computed(() => this.intent().status === 'canceled');
  readonly isPending = computed(() =>
    ['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(
      this.intent().status,
    ),
  );
  readonly isProcessing = computed(() => this.intent().status === 'processing');

  /** Whether can confirm */
  readonly canConfirm = computed(() =>
    ['requires_confirmation', 'requires_action'].includes(this.intent().status),
  );

  /** Whether can cancel */
  readonly canCancel = computed(
    () => !['succeeded', 'canceled', 'failed'].includes(this.intent().status),
  );

  /** Status badge class */
  readonly statusBadgeClass = computed(() => {
    return STATUS_BADGE_MAP[this.intent().status] || 'badge';
  });

  /** Status text */
  readonly statusText = computed(() => {
    return getStatusText(this.i18n, this.intent().status);
  });

  toggleExpanded(): void {
    this.expandedChange.emit(!this.expanded());
  }

  readonly providerLabel = computed(() => this.i18n.t(I18nKeys.ui.payment_provider));
  readonly statusLabel = computed(() => this.i18n.t(I18nKeys.ui.status_label));
  readonly amountLabel = computed(() => this.i18n.t(I18nKeys.ui.amount_label));
  readonly actionRequiredLabel = computed(() => this.i18n.t(I18nKeys.ui.action_required_label));
  readonly confirmButtonText = computed(() => this.i18n.t(I18nKeys.ui.confirm_button));
  readonly cancelButtonText = computed(() => this.i18n.t(I18nKeys.ui.cancel_button));
  readonly idLabel = computed(() => this.i18n.t(I18nKeys.ui.id_label));
  readonly clientSecretLabel = computed(() => this.i18n.t(I18nKeys.ui.client_secret));
  readonly redirectUrlLabel = computed(() => this.i18n.t(I18nKeys.ui.redirect_url));
}
