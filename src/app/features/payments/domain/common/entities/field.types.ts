/**
 * Field types supported in the form.
 */
export const FIELD_TYPES = ['text', 'email', 'hidden', 'url'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
