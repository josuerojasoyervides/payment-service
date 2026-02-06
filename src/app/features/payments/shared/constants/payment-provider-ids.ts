import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export const STRIPE_PROVIDER_ID: PaymentProviderId = 'stripe';
export const PAYPAL_PROVIDER_ID: PaymentProviderId = 'paypal';

export const PAYMENT_PROVIDER_IDS = {
  stripe: STRIPE_PROVIDER_ID,
  paypal: PAYPAL_PROVIDER_ID,
} as const;
