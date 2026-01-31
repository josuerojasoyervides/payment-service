import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import type { ProviderDescriptor } from '@payments/application/api/ports/payment-store.port';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

/**
 * Payment provider selector component.
 *
 * Displays visual buttons from catalog descriptors (labelKey, descriptionKey, icon).
 * No provider branching; render is descriptor-driven.
 *
 * @example
 * ```html
 * <app-provider-selector
 *   [descriptors]="catalog.getProviderDescriptors()"
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

  /** Provider descriptors from catalog (labelKey, descriptionKey, icon). */
  readonly descriptors = input.required<ProviderDescriptor[]>();

  /** Currently selected provider ID */
  readonly selected = input<PaymentProviderId | null>(null);

  /** Whether selector is disabled */
  readonly disabled = input<boolean>(false);

  /** Emits when a provider is selected */
  readonly providerChange = output<PaymentProviderId>();

  /** Resolved label/description/icon for template */
  readonly providerOptions = computed(() =>
    this.descriptors().map((d) => ({
      id: d.id,
      label: this.i18n.t(d.labelKey),
      description: d.descriptionKey ? this.i18n.t(d.descriptionKey) : undefined,
      icon: d.icon ?? '',
    })),
  );

  selectProvider(providerId: PaymentProviderId): void {
    if (!this.disabled() && providerId !== this.selected()) {
      this.providerChange.emit(providerId);
    }
  }

  readonly providerLabel = computed(() => this.i18n.t(I18nKeys.ui.provider_label));
}
