import { inject, Injectable } from '@angular/core';
import type {
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

import type { ProviderFactory } from '../../api/ports/provider-factory.port';
import { PAYMENT_PROVIDER_FACTORIES } from '../../api/tokens/payment-provider-factories.token';

/**
 * Registry of payment provider factories.
 *
 * Centralizes access to provider factories.
 * Validates no duplicates and that providers exist.
 *
 * Pattern: Registry
 * - Single access point for factories
 * - Caches references for performance
 */
@Injectable()
export class ProviderFactoryRegistry {
  private readonly factories = inject<ProviderFactory[]>(PAYMENT_PROVIDER_FACTORIES);

  /** Factory cache per providerId */
  private readonly factoryMap = new Map<PaymentProviderId, ProviderFactory>();

  constructor() {
    this.buildFactoryMap();
  }

  /**
   * Get the factory for a provider.
   *
   * @param providerId Provider ID (stripe, paypal)
   * @throws Error if provider is not registered
   */
  get(providerId: PaymentProviderId): ProviderFactory {
    const factory = this.factoryMap.get(providerId);
    if (!factory) {
      throw new Error(
        `Provider factory for "${providerId}" not found. ` +
          `Available providers: ${this.getAvailableProviders().join(', ')}`,
      );
    }
    return factory;
  }

  /**
   * Check if a provider is registered.
   */
  has(providerId: PaymentProviderId): boolean {
    return this.factoryMap.has(providerId);
  }

  /**
   * Return IDs of all available providers.
   */
  getAvailableProviders(): PaymentProviderId[] {
    return Array.from(this.factoryMap.keys());
  }

  /**
   * Return all providers that support a payment method.
   */
  getProvidersForMethod(type: PaymentMethodType): PaymentProviderId[] {
    return Array.from(this.factoryMap.entries())
      .filter(([_, factory]) => factory.supportsMethod?.(type) ?? true)
      .map(([id]) => id);
  }

  /**
   * Build factory map while validating duplicates.
   */
  private buildFactoryMap(): void {
    for (const factory of this.factories) {
      if (this.factoryMap.has(factory.providerId)) {
        const existing = this.factoryMap.get(factory.providerId)!;
        throw new Error(
          `Duplicate provider factory for "${factory.providerId}". ` +
            `Found: ${existing.constructor.name} and ${factory.constructor.name}`,
        );
      }
      this.factoryMap.set(factory.providerId, factory);
    }
  }
}
