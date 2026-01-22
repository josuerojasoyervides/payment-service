import { CommonModule, CurrencyPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { PaymentError, PaymentIntent, STATUS_BADGE_MAP } from '../../shared/ui.types';

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
  imports: [CommonModule, CurrencyPipe, JsonPipe],
  templateUrl: './payment-result.component.html',
})
export class PaymentResultComponent {
  private readonly i18n = inject(I18nService);

  /** Payment intent (if successful) */
  readonly intent = input<PaymentIntent | null>(null);

  /** Payment error (if failed) */
  readonly error = input<PaymentError | null>(null);

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
    const e = this.error();
    if (!e) return this.i18n.t(I18nKeys.ui.payment_error);
    if (typeof e === 'object' && 'message' in e) {
      return (e as { message: string }).message;
    }
    return this.i18n.t(I18nKeys.ui.payment_error);
  });

  /** Error code */
  readonly errorCode = computed(() => {
    const e = this.error();
    if (!e) return null;
    if (typeof e === 'object' && 'code' in e) {
      return (e as { code: string }).code;
    }
    return null;
  });

  /** CSS class for status badge */
  readonly statusBadgeClass = computed(() => {
    const i = this.intent();
    if (!i) return 'badge';
    return STATUS_BADGE_MAP[i.status] || 'badge';
  });

  /** Status text */
  readonly statusText = computed(() => {
    const i = this.intent();
    if (!i) return '';
    const statusKey = `messages.status_${i.status}`;
    return this.i18n.has(statusKey) ? this.i18n.t(statusKey) : i.status;
  });
  get paymentErrorTitle(): string {
    return this.i18n.t(I18nKeys.ui.payment_error);
  }

  get errorCodeLabel(): string {
    return this.i18n.t(I18nKeys.ui.error_code);
  }

  get viewTechnicalDetailsLabel(): string {
    return this.i18n.t(I18nKeys.ui.view_technical_details);
  }

  get tryAgainLabel(): string {
    return this.i18n.t(I18nKeys.ui.try_again);
  }

  get paymentCompletedTitle(): string {
    return this.i18n.t(I18nKeys.ui.payment_completed);
  }

  get paymentStartedTitle(): string {
    return this.i18n.t(I18nKeys.ui.payment_started_successfully);
  }

  get intentIdLabel(): string {
    return this.i18n.t(I18nKeys.ui.intent_id);
  }

  get providerLabel(): string {
    return this.i18n.t(I18nKeys.ui.provider);
  }

  get statusLabel(): string {
    return this.i18n.t(I18nKeys.ui.status);
  }

  get amountLabel(): string {
    return this.i18n.t(I18nKeys.ui.amount);
  }

  get viewFullResponseLabel(): string {
    return this.i18n.t(I18nKeys.ui.view_full_response);
  }

  get newPaymentLabel(): string {
    return this.i18n.t(I18nKeys.ui.new_payment);
  }
}
