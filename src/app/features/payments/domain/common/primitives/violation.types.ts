/**
 * Generic violation for value object validation.
 * Each VO can extend with specific codes or keep generic.
 */
export interface Violation {
  code: string;
  /** Optional context for translation or debugging */
  meta?: Record<string, number | string>;
}
