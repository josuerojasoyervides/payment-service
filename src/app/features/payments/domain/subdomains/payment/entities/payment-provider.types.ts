export const PAYMENT_PROVIDER_IDS = ['stripe', 'paypal'] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];
