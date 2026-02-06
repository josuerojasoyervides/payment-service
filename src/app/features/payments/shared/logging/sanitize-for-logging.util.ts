const DEFAULT_REDACT_KEYS = new Set([
  'token',
  'authorization',
  'password',
  'secret',
  'signature',
  'client_secret',
  'clientsecret',
  'card_number',
  'cardnumber',
  'cvc',
  'cvv',
  'pan',
]);

const REDACTED_VALUE = '[REDACTED]';

export interface SanitizeForLoggingOptions {
  /**
   * Additional key names to redact (case-insensitive).
   */
  redactKeys?: string[];
}

function normalizeKey(key: string): string {
  return key.replace(/[\s_-]/g, '').toLowerCase();
}

function shouldRedactKey(key: string, extraKeys: Set<string>): boolean {
  const normalized = normalizeKey(key);
  return DEFAULT_REDACT_KEYS.has(normalized) || extraKeys.has(normalized);
}

function sanitizeValue(value: unknown, extraKeys: Set<string>, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value !== 'object') return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, extraKeys, seen));
  }

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (shouldRedactKey(key, extraKeys)) {
      out[key] = REDACTED_VALUE;
      continue;
    }
    out[key] = sanitizeValue(entry, extraKeys, seen);
  }
  return out;
}

/**
 * Sanitizes values before logging by redacting sensitive keys.
 */
export function sanitizeForLogging<T>(value: T, options: SanitizeForLoggingOptions = {}): T {
  const extraKeys = new Set((options.redactKeys ?? []).map(normalizeKey));
  return sanitizeValue(value, extraKeys, new WeakSet()) as T;
}
