/**
 * Allowlist-based sanitizer for debug event payloads exposed to UI.
 * Prevents accidental exposure of secrets/PII (clientSecret, headers, token, email, raw, etc.).
 */

const ALLOWED_PAYLOAD_KEYS = new Set([
  'providerId',
  'referenceId',
  'eventId',
  'returnNonce',
  'operation',
  'attempt',
  'reason',
  'status',
]);

/**
 * Sanitizes the last-sent event for safe display in the UI debug panel.
 * Returns a shallow allowlisted object or null if input is invalid.
 *
 * @param input - Raw last sent event (or unknown)
 * @returns `{ type, payload? }` with only allowed keys in payload, or null
 */
export function sanitizeDebugEventForUi(
  input: unknown,
): { type: string; payload?: Record<string, unknown> } | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  const obj = input as Record<string, unknown>;
  const type = obj['type'];
  if (typeof type !== 'string') {
    return null;
  }
  const rawPayload = obj['payload'];
  let payload: Record<string, unknown> | undefined;
  if (
    rawPayload !== null &&
    rawPayload !== undefined &&
    typeof rawPayload === 'object' &&
    !Array.isArray(rawPayload)
  ) {
    const src = rawPayload as Record<string, unknown>;
    payload = {};
    for (const key of Object.keys(src)) {
      if (ALLOWED_PAYLOAD_KEYS.has(key)) {
        payload[key] = src[key];
      }
    }
    if (Object.keys(payload).length === 0) {
      payload = undefined;
    }
  }
  return payload !== undefined ? { type, payload } : { type };
}
