import { CommonModule, CurrencyPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import type { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { hasStringProp } from '@payments/ui/shared/has-string-prop';
import { renderPaymentError } from '@payments/ui/shared/render-payment-errors';

import { PaymentStatusLabelPipe } from '../../shared/pipes/payment-status-label.pipe';
import { STATUS_BADGE_MAP } from '../../shared/ui.types';

/**
 * Component that displays payment result.
 *
 * Can show a successful payment with intent details,
 * or an error with message and retry option.
 *
 * @example
 * ```html
 * <app-payment-result
 *   [intent]="currentIntent()"
 *   [error]="currentError()"
 *   (retry)="resetPayment()"
 *   (newPayment)="startNewPayment()"
 * />
 * ```
 */
@Component({
  selector: 'app-payment-result',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, JsonPipe, PaymentStatusLabelPipe],
  templateUrl: './payment-result.component.html',
})
export class PaymentResultComponent {
  private readonly i18n = inject(I18nService);

  /** Payment intent (if successful) */
  readonly intent = input<PaymentIntent | null>(null);

  /** Payment error (if failed) */
  readonly error = input<unknown | null>(null);

  /** Emits when user wants to retry */
  readonly retry = output<void>();

  /** Emits when user wants to make a new payment */
  readonly newPayment = output<void>();

  /** Whether there is a valid intent */
  readonly hasIntent = computed(() => this.intent() !== null);

  /** Whether there is an error */
  readonly hasError = computed(() => this.error() !== null);

  /** Whether payment was successful */
  readonly isSucceeded = computed(() => {
    const i = this.intent();
    return i !== null && i.status === 'succeeded';
  });

  /** Readable error message */
  readonly errorMessage = computed(() => {
    const error = this.error();
    if (!error) return this.i18n.t(I18nKeys.ui.payment_error);
    return renderPaymentError(this.i18n, error);
  });

  /** Error code */
  readonly errorCode = computed(() => {
    const e = this.error();
    if (!hasStringProp(e, 'code')) return null;
    return e.code;
  });

  /** CSS class for status badge */
  readonly statusBadgeClass = computed(() => {
    const i = this.intent();
    if (!i) return 'badge';
    return STATUS_BADGE_MAP[i.status] || 'badge';
  });

  readonly paymentErrorTitle = computed(() => this.i18n.t(I18nKeys.ui.payment_error));
  readonly errorCodeLabel = computed(() => this.i18n.t(I18nKeys.ui.error_code));
  readonly viewTechnicalDetailsLabel = computed(() =>
    this.i18n.t(I18nKeys.ui.view_technical_details),
  );
  readonly tryAgainLabel = computed(() => this.i18n.t(I18nKeys.ui.try_again));
  readonly paymentCompletedTitle = computed(() => this.i18n.t(I18nKeys.ui.payment_completed));
  readonly paymentStartedTitle = computed(() =>
    this.i18n.t(I18nKeys.ui.payment_started_successfully),
  );
  readonly intentIdLabel = computed(() => this.i18n.t(I18nKeys.ui.intent_id));
  readonly providerLabel = computed(() => this.i18n.t(I18nKeys.ui.provider));
  readonly statusLabel = computed(() => this.i18n.t(I18nKeys.ui.status));
  readonly amountLabel = computed(() => this.i18n.t(I18nKeys.ui.amount));
  readonly viewFullResponseLabel = computed(() => this.i18n.t(I18nKeys.ui.view_full_response));
  readonly newPaymentLabel = computed(() => this.i18n.t(I18nKeys.ui.new_payment));
}
