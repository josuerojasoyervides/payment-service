import { I18nKeys, I18nService } from '@core/i18n';

type I18nSafeParams = Record<string, string | number>;
type LooseParams = Record<string, unknown>;

interface MaybePaymentError {
  message?: string;
  messageKey?: string;
  params?: LooseParams;
}

interface MaybeValidationError {
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

export function renderPaymentError(i18n: I18nService, error: unknown): string {
  if (!error) return i18n.t(I18nKeys.ui.unknown_error);

  // Si te llega Error nativo (throw new Error(...))
  if (error instanceof Error) {
    const msg = error.message;

    if (looksLikeI18nKey(msg)) {
      return i18n.t(msg);
    }

    return msg || i18n.t(I18nKeys.ui.unknown_error);
  }

  // Validation error (PaymentValidationError)
  if (isObject(error) && 'messageKey' in error) {
    const validationError = error as MaybeValidationError;

    if (typeof validationError.messageKey === 'string') {
      return i18n.t(validationError.messageKey, sanitizeI18nParams(validationError.params));
    }
  }

  // PaymentError-like
  if (isObject(error) && ('messageKey' in error || 'message' in error)) {
    const paymentError = error as MaybePaymentError;

    if (typeof paymentError.messageKey === 'string') {
      return i18n.t(paymentError.messageKey, sanitizeI18nParams(paymentError.params));
    }

    if (typeof paymentError.message === 'string') {
      // Si message parece key -> traducir
      if (looksLikeI18nKey(paymentError.message)) {
        return i18n.t(paymentError.message, sanitizeI18nParams(paymentError.params));
      }

      // Si no parece key -> texto legacy
      return paymentError.message;
    }
  }

  return i18n.t(I18nKeys.ui.unknown_error);
}
