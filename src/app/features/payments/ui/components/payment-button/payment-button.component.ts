import { Component, input, output, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { PaymentProviderId, CurrencyCode, PaymentButtonState } from '../../shared';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Payment button component with visual states.
 *
 * Displays the amount to pay and selected provider,
 * with different states: idle, loading, success, error.
 *
 * @example
 * ```html
 * <app-payment-button
 *   [amount]="499.99"
 *   [currency]="'MXN'"
 *   [provider]="'stripe'"
 *   [loading]="isLoading()"
 *   [disabled]="!isFormValid()"
 *   (pay)="processPayment()"
 * />
 * ```
 */
@Component({
  selector: 'app-payment-button',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './payment-button.component.html',
})
export class PaymentButtonComponent {
  private readonly i18n = inject(I18nService);

  /** Amount to pay */
  readonly amount = input.required<number>();

  /** Currency code */
  readonly currency = input.required<CurrencyCode>();

  /** Payment provider */
  readonly provider = input<PaymentProviderId | null>(null);

  /** Whether in loading state */
  readonly loading = input<boolean>(false);

  /** Whether button is disabled */
  readonly disabled = input<boolean>(false);

  /** Explicit button state */
  readonly buttonState = input<PaymentButtonState>('idle');

  /** Emits when button is clicked */
  readonly pay = output<void>();

  /** Computed button state */
  readonly state = computed<PaymentButtonState>(() => {
    if (this.loading()) return 'loading';
    return this.buttonState();
  });

  /** Readable provider name */
  readonly providerName = computed(() => {
    const p = this.provider();
    if (!p) return '';
    if (p === 'stripe') return this.i18n.t(I18nKeys.ui.provider_stripe);
    if (p === 'paypal') return this.i18n.t(I18nKeys.ui.provider_paypal);
    const providerStr = String(p);
    return providerStr.charAt(0).toUpperCase() + providerStr.slice(1);
  });

  get processingText(): string {
    return this.i18n.t(I18nKeys.ui.processing);
  }

  get paymentSuccessfulText(): string {
    return this.i18n.t(I18nKeys.ui.payment_successful);
  }

  get paymentErrorText(): string {
    return this.i18n.t(I18nKeys.ui.payment_error_text);
  }

  get payWithText(): string {
    return this.i18n.t(I18nKeys.ui.pay_with);
  }

  get withText(): string {
    return this.i18n.t(I18nKeys.ui.with);
  }

  /** Button CSS classes based on state */
  readonly buttonClasses = computed(() => {
    const state = this.state();
    const disabled = this.disabled() || this.loading();

    const base = 'focus:outline-none focus:ring-2 focus:ring-offset-2';

    if (state === 'success') {
      return `${base} bg-green-600 text-white cursor-default`;
    }

    if (state === 'error') {
      return `${base} bg-red-600 text-white cursor-default`;
    }

    if (disabled) {
      return `${base} bg-gray-300 text-gray-500 cursor-not-allowed`;
    }

    const provider = this.provider();
    if (provider === 'stripe') {
      return `${base} bg-stripe-primary hover:opacity-90 text-white focus:ring-stripe-primary`;
    }
    if (provider === 'paypal') {
      return `${base} bg-paypal-primary hover:opacity-90 text-white focus:ring-paypal-primary`;
    }

    return `${base} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500`;
  });

  handleClick(): void {
    if (!this.disabled() && !this.loading()) {
      this.pay.emit();
    }
  }
}
