import { I18nKeys, I18nService } from '@core/i18n';

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

    // Evitar cosas como { a: {x:1} } => "[object Object]"
    // Si luego quieres permitir Date, BigInt, etc. aquí es el lugar.
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function looksLikeI18nKey(value: string): boolean {
  // Keys tipo: "errors.provider_error", "ui.payment_problem"
  // Evita traducciones accidentales de strings humanos
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
