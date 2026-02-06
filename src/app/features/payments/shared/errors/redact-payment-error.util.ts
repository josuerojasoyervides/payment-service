import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';

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

function normalizeKey(key: string): string {
  return key.replace(/[\s_-]/g, '').toLowerCase();
}

function buildRedactKeys(piiFields: string[]): Set<string> {
  const keys = new Set(DEFAULT_REDACT_KEYS);
  for (const field of piiFields) {
    keys.add(normalizeKey(field));
  }
  return keys;
}

function sanitizeRaw(raw: unknown, redactKeys: Set<string>, seen: WeakSet<object>): unknown {
  if (!raw || typeof raw !== 'object') return raw;

  if (seen.has(raw)) return '[Circular]';
  seen.add(raw);

  if (Array.isArray(raw)) {
    return raw.map((entry) => sanitizeRaw(entry, redactKeys, seen));
  }

  const record = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (redactKeys.has(normalizeKey(key))) {
      out[key] = REDACTED_VALUE;
      continue;
    }
    out[key] = sanitizeRaw(value, redactKeys, seen);
  }
  return out;
}

/**
 * Redacts PII fields from PaymentError.raw using injectable field names.
 */
export function redactPaymentError(
  error: PaymentError | null | undefined,
  piiFields: string[] = [],
): PaymentError | null {
  if (!error) return null;

  if (!error.raw || typeof error.raw !== 'object') return error;

  const redactKeys = buildRedactKeys(piiFields);
  const sanitizedRaw = sanitizeRaw(error.raw, redactKeys, new WeakSet());

  return {
    ...error,
    raw: sanitizedRaw,
  };
}
