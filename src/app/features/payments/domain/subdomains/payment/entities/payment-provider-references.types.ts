import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

export const PROVIDER_REFERENCE_KEYS = [
  'intentId',
  'orderId',
  'preferenceId',
  'paymentId',
] as const;
export type ProviderReferenceKey = (typeof PROVIDER_REFERENCE_KEYS)[number];

/**
 * Provider reference bag.
 * - Known keys are suggested via `ProviderReferenceKey`.
 * - Additional provider-specific keys are allowed as optional string entries.
 */
export type ProviderReferenceSet = Partial<Record<ProviderReferenceKey, string>> &
  Record<string, string | undefined>;

export type ProviderRefs = ProviderReferenceSet;
export type ProviderReferences = Partial<Record<PaymentProviderId, ProviderRefs>>;
