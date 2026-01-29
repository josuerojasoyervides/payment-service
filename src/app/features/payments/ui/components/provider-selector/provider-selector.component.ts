import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { ProviderOption } from '@payments/ui/shared/ui.types';
import { getDefaultProviders } from '@payments/ui/shared/ui.types';

/**
 * Payment provider selector component.
 *
 * Displays visual buttons to select between Stripe, PayPal, etc.
 *
 * @example
 * ```html
 * <app-provider-selector
 *   [providers]="['stripe', 'paypal']"
 *   [selected]="selectedProvider()"
 *   [disabled]="isLoading()"
 *   (providerChange)="onProviderChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-provider-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './provider-selector.component.html',
})
export class ProviderSelectorComponent {
  private readonly i18n = inject(I18nService);

  /** List of available provider IDs */
  readonly providers = input.required<PaymentProviderId[]>();

  /** Currently selected provider */
  readonly selected = input<PaymentProviderId | null>(null);

  /** Whether selector is disabled */
  readonly disabled = input<boolean>(false);

  /** Emits when a provider is selected */
  readonly providerChange = output<PaymentProviderId>();

  /** Provider options with metadata */
  readonly providerOptions = computed(() => {
    const defaultProviders = getDefaultProviders(this.i18n);
    return this.providers()
      .map((id) => defaultProviders.find((p) => p.id === id))
      .filter((p): p is ProviderOption => p !== undefined);
  });

  selectProvider(providerId: PaymentProviderId): void {
    if (!this.disabled() && providerId !== this.selected()) {
      this.providerChange.emit(providerId);
    }
  }

  readonly providerLabel = computed(() => this.i18n.t(I18nKeys.ui.provider_label));
}
