import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys, I18nService } from '@core/i18n';
import type { PaymentProviderUiMeta } from '@payments/presentation/tokens/provider/payment-provider-ui-meta.token';
import { PAYMENT_PROVIDER_UI_META } from '@payments/presentation/tokens/provider/payment-provider-ui-meta.token';
import type { PaymentButtonState } from '@payments/ui/shared/ui.types';
import { TrackClickDirective } from '@shared/directives/track-click.directive';

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
 *   [provider]="providerId"
 *   [loading]="isLoading()"
 *   [disabled]="!isFormValid()"
 *   (pay)="processPayment()"
 * />
 * ```
 */
@Component({
  selector: 'app-payment-button',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, TrackClickDirective],
  templateUrl: './payment-button.component.html',
})
export class PaymentButtonComponent {
  private readonly i18n = inject(I18nService);
  private readonly providerUiMetaList = inject(PAYMENT_PROVIDER_UI_META, { optional: true });

  private readonly providerUiMetaById = computed<Map<PaymentProviderId, PaymentProviderUiMeta>>(
    () => {
      const map = new Map<PaymentProviderId, PaymentProviderUiMeta>();
      const list = this.providerUiMetaList ?? [];

      for (const meta of list) {
        map.set(meta.providerId, meta);
      }

      return map;
    },
  );

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

    const meta = this.providerUiMetaById().get(p);
    if (meta?.displayNameKey) {
      return this.i18n.t(meta.displayNameKey);
    }

    const providerStr = String(p);
    return providerStr.charAt(0).toUpperCase() + providerStr.slice(1);
  });

  readonly processingText = computed(() => this.i18n.t(I18nKeys.ui.processing));

  readonly paymentSuccessfulText = computed(() => this.i18n.t(I18nKeys.ui.payment_successful));

  readonly paymentErrorText = computed(() => this.i18n.t(I18nKeys.ui.payment_error_text));

  readonly payWithText = computed(() => this.i18n.t(I18nKeys.ui.pay_with));

  readonly withText = computed(() => this.i18n.t(I18nKeys.ui.with));

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
    const meta = provider ? (this.providerUiMetaById().get(provider) ?? null) : null;

    if (meta?.buttonClasses) {
      return `${base} ${meta.buttonClasses}`;
    }

    return `${base} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500`;
  });

  private lastClickAt = 0;

  handleClick(): void {
    if (!this.disabled() && !this.loading()) {
      const now = Date.now();
      if (now - this.lastClickAt < 300) return;
      this.lastClickAt = now;
      this.pay.emit();
    }
  }
}
