/**
 * Supported currency codes.
 * Lives in common so Money VO and subdomains can share.
 */
export const CURRENCY_CODES = ['MXN', 'USD'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
