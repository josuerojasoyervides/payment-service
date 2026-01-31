/**
 * Strict allowlist for telemetry payloads (PR6).
 * Never include: raw, headers, clientSecret, token, email, authorization, request, response.
 */

const ALLOWLIST = new Set([
  'providerId',
  'referenceId',
  'eventId',
  'returnNonce',
  'operation',
  'attempt',
  'reason',
  'status',
  'code',
  'messageKey',
]);

const FORBIDDEN = new Set([
  'raw',
  'headers',
  'clientSecret',
  'token',
  'email',
  'authorization',
  'request',
  'response',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonSerializable(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(isJsonSerializable);
  if (isPlainObject(value)) {
    return Object.values(value).every(isJsonSerializable);
  }
  return false;
}

/**
 * Returns a shallow allowlisted copy of input, or null for non-object input.
 * Unknown keys are ignored. Forbidden keys are never included.
 * Output is JSON-serializable.
 */
export function sanitizeTelemetryPayloadForSink(input: unknown): Record<string, unknown> | null {
  if (!isPlainObject(input)) return null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    if (FORBIDDEN.has(key)) continue;
    if (!ALLOWLIST.has(key)) continue;
    const v = (input as Record<string, unknown>)[key];
    if (!isJsonSerializable(v)) continue;
    out[key] = v;
  }
  return out;
}
