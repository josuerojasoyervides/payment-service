import { inject, Injectable } from '@angular/core';
import {
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ProviderFactory } from '@payments/domain/ports';

import { PAYMENT_PROVIDER_FACTORIES } from '../tokens/payment-provider-factories.token';

/**
 * Registro de factories de proveedores de pago.
 *
 * Centraliza el acceso a las factories de cada proveedor.
 * Valida que no haya duplicados y que los providers existan.
 *
 * Patrón: Registry
 * - Punto único de acceso a las factories
 * - Cachea referencias para mejor rendimiento
 */
@Injectable()
export class ProviderFactoryRegistry {
  private readonly factories = inject<ProviderFactory[]>(PAYMENT_PROVIDER_FACTORIES);

  /** Cache de factories por providerId */
  private readonly factoryMap = new Map<PaymentProviderId, ProviderFactory>();

  constructor() {
    this.buildFactoryMap();
  }

  /**
   * Obtiene la factory para un proveedor.
   *
   * @param providerId ID del proveedor (stripe, paypal)
   * @throws Error si el provider no está registrado
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
   * Verifica si un proveedor está registrado.
   */
  has(providerId: PaymentProviderId): boolean {
    return this.factoryMap.has(providerId);
  }

  /**
   * Retorna los IDs de todos los proveedores disponibles.
   */
  getAvailableProviders(): PaymentProviderId[] {
    return Array.from(this.factoryMap.keys());
  }

  /**
   * Retorna todos los proveedores que soportan un método de pago.
   */
  getProvidersForMethod(type: PaymentMethodType): PaymentProviderId[] {
    return Array.from(this.factoryMap.entries())
      .filter(([_, factory]) => factory.supportsMethod?.(type) ?? true)
      .map(([id]) => id);
  }

  /**
   * Construye el mapa de factories validando duplicados.
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
