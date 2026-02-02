import { inject, Injectable } from '@angular/core';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ProviderDescriptor } from '@payments/application/api/ports/payment-store.port';
import { PAYMENT_PROVIDER_DESCRIPTORS } from '@payments/presentation/tokens/provider/payment-provider-descriptors.token';

/**
 * Registry of provider descriptors (labelKey, descriptionKey, icon, badges).
 * Fed by config/infra via PAYMENT_PROVIDER_DESCRIPTORS multi token.
 * Used by catalog port; no UI coupling.
 */
@Injectable()
export class ProviderDescriptorRegistry {
  private readonly descriptors = inject(PAYMENT_PROVIDER_DESCRIPTORS, { optional: true }) ?? [];
  private readonly byId = new Map<PaymentProviderId, ProviderDescriptor>(
    this.descriptors.map((d) => [d.id, d]),
  );

  getProviderDescriptors(): ProviderDescriptor[] {
    return Array.from(this.byId.values());
  }

  getProviderDescriptor(providerId: PaymentProviderId): ProviderDescriptor | null {
    return this.byId.get(providerId) ?? null;
  }
}
