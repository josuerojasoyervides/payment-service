import { InjectionToken } from '@angular/core';
import type { PaymentStrategy } from '@payments/application/api/ports/payment-strategy.port';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

/**
 * Token to inject payment strategies by provider.
 *
 * Each provider registers its own strategies using multi: true.
 * This allows adding new payment methods without modifying existing code.
 */
export const PAYMENT_STRATEGIES = new InjectionToken<PaymentStrategy[]>('PAYMENT_STRATEGIES');

/**
 * Interface to register strategies with metadata.
 */
export interface RegisteredStrategy {
  /** Provider this strategy belongs to */
  providerId: PaymentProviderId;
  /** The strategy itself */
  strategy: PaymentStrategy;
}

/**
 * Token for strategies with their metadata.
 */
export const REGISTERED_PAYMENT_STRATEGIES = new InjectionToken<RegisteredStrategy[]>(
  'REGISTERED_PAYMENT_STRATEGIES',
);
