import type { I18nService } from '@core/i18n';
import { I18nKeys } from '@core/i18n';

type I18nSafeParams = Record<string, string | number>;
type LooseParams = Record<string, unknown>;

interface MaybeI18nErrorShape {
  messageKey?: string;
  params?: LooseParams;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value);
}

/**
 * Sanitize params to match I18nService.t() contract:
 * Record<string, string | number>
 */
function sanitizeI18nParams(params: unknown): I18nSafeParams | undefined {
  if (!isRecord(params)) return undefined;

  const out: I18nSafeParams = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'string' || typeof value === 'number') {
      out[key] = value;
      continue;
    }

    if (typeof value === 'boolean') {
      out[key] = value ? 'true' : 'false';
      continue;
    }

    // Avoid cases like { a: {x:1} } => "[object Object]"
    // If you later want to allow Date, BigInt, etc., this is the place.
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function looksLikeI18nKey(value: string): boolean {
  // Keys like: "errors.provider_error", "ui.payment_problem"
  // Avoid accidental translation of human strings
  return value.includes('.') && !value.includes(' ');
}

/**
 * Strict renderer: UI must only render i18n keys.
 *
 * ✅ Accepts: { messageKey, params } shapes
 * ❌ Rejects: legacy human text or Error.message (will become unknown_error)
 */
export function renderPaymentError(i18n: I18nService, error: unknown): string {
  if (!error) return i18n.t(I18nKeys.errors.unknown_error);

  // Generic error shape: { messageKey, params }
  if (isObject(error) && 'messageKey' in error) {
    const e = error as MaybeI18nErrorShape;

    if (typeof e.messageKey === 'string' && looksLikeI18nKey(e.messageKey)) {
      return i18n.t(e.messageKey, sanitizeI18nParams(e.params));
    }

    // messageKey exists but is not an i18n key => treat as unknown
    return i18n.t(I18nKeys.errors.unknown_error);
  }

  return i18n.t(I18nKeys.errors.unknown_error);
}
