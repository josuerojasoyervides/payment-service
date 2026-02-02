/**
 * Catalog of known payment providers (operational concern).
 * Lives in Application — not Domain — to allow adding providers without touching Domain (OCP).
 *
 * Domain uses opaque PaymentProviderId (string); consumers that need the union type
 * import from this catalog.
 */
export const KNOWN_PROVIDER_IDS = ['stripe', 'paypal'] as const;

export type KnownPaymentProviderId = (typeof KNOWN_PROVIDER_IDS)[number];
