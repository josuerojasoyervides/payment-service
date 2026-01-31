import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { I18nKeys, I18nService } from '@core/i18n';
import type { PaymentCheckoutCatalogPort } from '@payments/application/api/ports/payment-store.port';
import type { FallbackAvailableEvent } from '@payments/domain/subdomains/fallback/contracts/fallback-event.event';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { renderPaymentError } from '@payments/ui/shared/render-payment-errors';

/**
 * Modal that displays fallback options when a provider fails.
 *
 * Allows user to select an alternative provider
 * or cancel the fallback process.
 *
 * @example
 * ```html
 * <app-fallback-modal
 *   [event]="pendingFallbackEvent()"
 *   [open]="hasPendingFallback()"
 *   (confirm)="confirmFallback($event)"
 *   (cancel)="cancelFallback()"
 * />
 * ```
 */
@Component({
  selector: 'app-fallback-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fallback-modal.component.html',
})
export class FallbackModalComponent {
  private readonly i18n = inject(I18nService);
  private readonly catalog = inject(PAYMENT_CHECKOUT_CATALOG) as PaymentCheckoutCatalogPort;

  /** Pending fallback event */
  readonly event = input<FallbackAvailableEvent | null>(null);

  /** Whether modal is open */
  readonly open = input<boolean>(false);

  /** Emits when user confirms fallback */
  readonly confirm = output<PaymentProviderId>();

  /** Emits when user cancels */
  readonly canceled = output<void>();

  /** Selected provider */
  readonly selectedProvider = signal<PaymentProviderId | null>(null);

  /** Track previous eventId to detect changes */
  private previousEventId: string | null = null;

  constructor() {
    // Reset selectedProvider when modal closes
    effect(() => {
      const isOpen = this.open();
      if (!isOpen) {
        this.selectedProvider.set(null);
      }
    });

    // Reset selectedProvider when eventId changes (new fallback event)
    effect(() => {
      const currentEvent = this.event();
      const currentEventId = currentEvent?.eventId ?? null;

      if (this.previousEventId !== null && currentEventId !== this.previousEventId) {
        // EventId changed - reset selection
        this.selectedProvider.set(null);
      }

      this.previousEventId = currentEventId;
    });
  }

  /** Error message from event */
  readonly errorMessageText = computed(() => {
    const e = this.event();
    return renderPaymentError(this.i18n, e?.error);
  });

  /** Alternative providers with label/description from catalog */
  readonly alternativeProviders = computed(() => {
    const e = this.event();
    if (!e) return [];
    return e.alternativeProviders
      .map((id) => this.catalog.getProviderDescriptor(id))
      .filter((d): d is NonNullable<typeof d> => d != null)
      .map((d) => ({
        id: d.id,
        label: this.i18n.t(d.labelKey),
        description: d.descriptionKey ? this.i18n.t(d.descriptionKey) : undefined,
        icon: d.icon,
      }));
  });

  /** Selected provider label from catalog */
  readonly selectedProviderName = computed(() => {
    const id = this.selectedProvider();
    if (!id) return null;
    const d = this.catalog.getProviderDescriptor(id);
    return d ? this.i18n.t(d.labelKey) : id;
  });

  // ===== Textos para el template =====
  readonly paymentProblemTitle = computed(() => this.i18n.t(I18nKeys.ui.payment_problem));

  readonly providerUnavailableText = computed(() => this.i18n.t(I18nKeys.ui.provider_unavailable));
  readonly tryAnotherProviderText = computed(() => this.i18n.t(I18nKeys.ui.try_another_provider));

  readonly cancelLabel = computed(() => this.i18n.t(I18nKeys.ui.cancel));
  readonly retryWithLabel = computed(() => this.i18n.t(I18nKeys.ui.retry_with));

  selectProvider(providerId: PaymentProviderId): void {
    this.selectedProvider.set(providerId);
  }

  onConfirm(): void {
    const provider = this.selectedProvider();
    if (provider) {
      this.confirm.emit(provider);
      this.selectedProvider.set(null);
    }
  }

  onCancel(): void {
    this.canceled.emit();
    this.selectedProvider.set(null);
  }

  onOverlayClick(event: Event) {
    if (event instanceof MouseEvent) {
      const target = event.target as HTMLElement | null;
      const currentTarget = event.currentTarget as HTMLElement | null;

      if (target !== currentTarget) return;
    }

    this.onCancel();
  }
}
