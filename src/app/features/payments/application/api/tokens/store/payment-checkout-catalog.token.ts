/**
 * Token for the checkout catalog (providers, methods, field requirements, request builder).
 * UI injects this for checkout form only; flow state/actions use PAYMENT_STATE.
 *
 * Wiring: config binds PAYMENT_CHECKOUT_CATALOG to the same adapter (useExisting)
 * so a single instance serves both tokens.
 */
import { InjectionToken } from '@angular/core';
import type { PaymentCheckoutCatalogPort } from '@payments/application/api/ports/payment-store.port';

export const PAYMENT_CHECKOUT_CATALOG = new InjectionToken<PaymentCheckoutCatalogPort>(
  'PaymentCheckoutCatalog',
);
