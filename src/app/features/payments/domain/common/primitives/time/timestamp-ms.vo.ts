import type { Result } from '@payments/domain/common/primitives/result.types';

export type TimestampMsViolationCode =
  | 'TIMESTAMP_MS_NOT_A_NUMBER'
  | 'TIMESTAMP_MS_NOT_FINITE'
  | 'TIMESTAMP_MS_NEGATIVE'
  | 'TIMESTAMP_MS_LIKELY_SECONDS';

export interface TimestampMsViolation {
  code: TimestampMsViolationCode;
  meta?: Record<string, number | string>;
}

/**
 * TimestampMs value object.
 * Represents a point in time as epoch milliseconds (UTC).
 *
 * Invariants:
 * - Number.isFinite(value)
 * - value >= 0
 * - Heuristic: if value < 10^11, likely provided in seconds (not ms) — optional violation
 *
 * NOTE: No date range (e.g. 2020–2030) in Domain to avoid fragile tests and historical data.
 * Application layer can enforce "not future" or "not too old" if needed.
 */
export interface TimestampMs {
  readonly value: number;
}

/**
 * Threshold below which a value is likely in seconds, not milliseconds.
 * 10^11 ms ≈ 1973; values like 1700000000 are seconds (2023).
 */
const LIKELY_SECONDS_THRESHOLD = 1e11;

/**
 * Creates a TimestampMs value object.
 *
 * @param raw - The raw number (expected epoch milliseconds)
 * @param options - If strictSecondsCheck is true, rejects values that look like seconds
 * @returns Result with TimestampMs or violations
 */
export interface TimestampMsOptions {
  /**
   * If true, values below 10^11 are rejected as "likely seconds".
   * Use when input is expected to be milliseconds only.
   */
  rejectLikelySeconds?: boolean;
}

function from(
  raw: number,
  options?: TimestampMsOptions,
): Result<TimestampMs, TimestampMsViolation> {
  const violations: TimestampMsViolation[] = [];

  if (typeof raw !== 'number') {
    violations.push({
      code: 'TIMESTAMP_MS_NOT_A_NUMBER',
      meta: { value: raw as unknown as number },
    });
    return { ok: false, violations };
  }

  if (!Number.isFinite(raw)) {
    violations.push({
      code: 'TIMESTAMP_MS_NOT_FINITE',
      meta: { value: raw },
    });
    return { ok: false, violations };
  }

  if (raw < 0) {
    violations.push({
      code: 'TIMESTAMP_MS_NEGATIVE',
      meta: { value: raw },
    });
    return { ok: false, violations };
  }

  if (options?.rejectLikelySeconds && raw > 0 && raw < LIKELY_SECONDS_THRESHOLD) {
    violations.push({
      code: 'TIMESTAMP_MS_LIKELY_SECONDS',
      meta: { value: raw, threshold: LIKELY_SECONDS_THRESHOLD },
    });
    return { ok: false, violations };
  }

  return {
    ok: true,
    value: { value: raw },
  };
}

/**
 * Creates a TimestampMs for the current time (epoch ms).
 */
function now(): TimestampMs {
  return { value: Date.now() };
}

export const TimestampMs = {
  from,
  now,
  LIKELY_SECONDS_THRESHOLD,
};
