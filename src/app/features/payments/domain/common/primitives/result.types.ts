import type { Violation } from './violation.types';

/**
 * Result type for value object construction.
 * No external library — pure domain.
 */
export type Result<T, V extends Violation = Violation> =
  | { ok: true; value: T }
  | { ok: false; violations: V[] };
