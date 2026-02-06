import type { Result } from '@payments/domain/common/primitives/result.types';

export type FlowIdViolationCode =
  | 'FLOW_ID_EMPTY'
  | 'FLOW_ID_MISSING_PREFIX'
  | 'FLOW_ID_TOO_LONG'
  | 'FLOW_ID_INVALID_CHARSET';

export interface FlowIdViolation {
  code: FlowIdViolationCode;
  meta?: Record<string, number | string>;
}

/**
 * FlowId value object.
 * Represents a unique identifier for a payment flow (correlation, idempotency, persistence).
 *
 * Invariants:
 * - Non-empty after trim
 * - Prefix "flow_"
 * - Max 128 characters
 * - Safe charset after prefix: [A-Za-z0-9_-]
 *
 * Format: flow_<base36_timestamp>_<suffix> (e.g. flow_lxyz123_abc1def2)
 */
export interface FlowId {
  readonly value: string;
}

const PREFIX = 'flow_';
const MAX_LENGTH = 128;
const FULL_REGEX = /^flow_[A-Za-z0-9_-]+$/;

/**
 * Creates a FlowId value object from a raw string.
 *
 * @param raw - The raw flow id string
 * @returns Result with FlowId or violations
 */
function from(raw: string): Result<FlowId, FlowIdViolation> {
  const violations: FlowIdViolation[] = [];

  const trimmed = (raw ?? '').trim();

  if (trimmed.length === 0) {
    violations.push({
      code: 'FLOW_ID_EMPTY',
    });
    return { ok: false, violations };
  }

  if (!trimmed.startsWith(PREFIX)) {
    violations.push({
      code: 'FLOW_ID_MISSING_PREFIX',
      meta: { value: trimmed, expectedPrefix: PREFIX },
    });
    return { ok: false, violations };
  }

  if (trimmed.length > MAX_LENGTH) {
    violations.push({
      code: 'FLOW_ID_TOO_LONG',
      meta: { length: trimmed.length, max: MAX_LENGTH },
    });
    return { ok: false, violations };
  }

  if (!FULL_REGEX.test(trimmed)) {
    violations.push({
      code: 'FLOW_ID_INVALID_CHARSET',
      meta: { value: trimmed },
    });
    return { ok: false, violations };
  }

  return {
    ok: true,
    value: { value: trimmed },
  };
}

/**
 * Builds a FlowId from timestamp (base36) and suffix.
 * Matches the format used by defaultFlowIdGenerator: flow_${nowMs.toString(36)}_${suffix}
 *
 * @param nowMs - Epoch milliseconds (will be encoded as base36)
 * @param suffix - Suffix after the underscore (e.g. random hex from createRandomSuffix())
 * @returns Result with FlowId or violations
 */
function build(nowMs: number, suffix: string): Result<FlowId, FlowIdViolation> {
  const built = `${PREFIX}${nowMs.toString(36)}_${suffix}`;
  return from(built);
}

export const FlowId = {
  from,
  build,
  PREFIX,
  MAX_LENGTH,
};
