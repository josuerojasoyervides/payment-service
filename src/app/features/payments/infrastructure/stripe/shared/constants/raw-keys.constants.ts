export const SPEI_RAW_KEYS = {
  SPEI: 'spei',
  BANK: 'bank',
  CLABE: 'clabe',
  REFERENCE: 'reference',
} as const;

export type SpeiRawKey = (typeof SPEI_RAW_KEYS)[keyof typeof SPEI_RAW_KEYS];

export const CARD_RAW_KEYS = {
  CARD: 'card',
  BANKS: 'bank',
  CLABE: 'clabe',
  REFERENCE: 'reference',
} as const;

export type CardRawKey = (typeof CARD_RAW_KEYS)[keyof typeof CARD_RAW_KEYS];
