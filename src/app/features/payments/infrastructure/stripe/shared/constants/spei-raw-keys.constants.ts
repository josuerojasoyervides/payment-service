export const SPEI_RAW_KEYS = {
  SPEI: 'spei',
  BANK: 'bank',
  CLABE: 'clabe',
  REFERENCE: 'reference',
} as const;

export type SpeiRawKey = (typeof SPEI_RAW_KEYS)[keyof typeof SPEI_RAW_KEYS];
