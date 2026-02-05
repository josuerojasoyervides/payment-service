import { InjectionToken } from '@angular/core';
import type { ProviderDescriptor } from '@payments/application/api/ports/payment-store.port';

/**
 * Multi token: each provider module (stripe, paypal) provides one descriptor.
 * ProviderDescriptorRegistry injects this and builds the catalog.
 */
export const PAYMENT_PROVIDER_DESCRIPTORS = new InjectionToken<ProviderDescriptor[]>(
  'PAYMENT_PROVIDER_DESCRIPTORS',
);
