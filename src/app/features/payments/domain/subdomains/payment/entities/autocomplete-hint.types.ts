export const AUTOCOMPLETE_HINTS = [
  'email',
  'name',
  'given-name',
  'family-name',
  'tel',
  'street-address',
  'postal-code',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'off',
  'current-url',
] as const;

export type AutoCompleteHint = (typeof AUTOCOMPLETE_HINTS)[number];
