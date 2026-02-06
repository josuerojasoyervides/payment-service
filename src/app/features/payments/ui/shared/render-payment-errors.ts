import type { I18nService } from '@core/i18n';
import { I18nKeys } from '@core/i18n';
import type { PaymentErrorCode } from '@payments/domain/subdomains/payment/entities/payment-error.types';

type I18nSafeParams = Record<string, string | number>;
type LooseParams = Record<string, unknown>;

interface MaybeI18nErrorShape {
  messageKey?: string;
  params?: LooseParams;
  code?: PaymentErrorCode;
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

function mapErrorCodeToKey(code: PaymentErrorCode | undefined): string | null {
  if (!code) return null;

  const map: Record<PaymentErrorCode, string> = {
    invalid_request: I18nKeys.errors.invalid_request,
    missing_provider: I18nKeys.errors.missing_provider,
    provider_unavailable: I18nKeys.errors.provider_error,
    provider_error: I18nKeys.errors.provider_error,
    network_error: I18nKeys.errors.network_error,
    timeout: I18nKeys.errors.timeout,
    processing_timeout: I18nKeys.errors.processing_timeout,
    unknown_error: I18nKeys.errors.unknown_error,
    currency_not_supported: I18nKeys.errors.currency_not_supported,
    amount_below_minimum: I18nKeys.errors.min_amount,
    amount_above_maximum: I18nKeys.errors.max_amount,
    card_declined: I18nKeys.errors.card_declined,
    insufficient_funds: I18nKeys.errors.insufficient_funds,
    expired_card: I18nKeys.errors.expired_card,
    requires_action: I18nKeys.errors.authentication_required,
    unsupported_client_confirm: I18nKeys.errors.unsupported_client_confirm,
    unsupported_finalize: I18nKeys.errors.unsupported_finalize,
    return_correlation_mismatch: I18nKeys.errors.return_correlation_mismatch,
    fallback_handled: I18nKeys.errors.provider_error,
  };

  return map[code] ?? null;
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

    const codeKey = mapErrorCodeToKey(e.code);
    if (codeKey) {
      return i18n.t(codeKey, sanitizeI18nParams(e.params));
    }

    // messageKey exists but is not an i18n key => treat as unknown
    return i18n.t(I18nKeys.errors.unknown_error);
  }

  if (isObject(error) && 'code' in error) {
    const codeKey = mapErrorCodeToKey((error as MaybeI18nErrorShape).code);
    if (codeKey) {
      return i18n.t(codeKey, sanitizeI18nParams((error as MaybeI18nErrorShape).params));
    }
  }

  return i18n.t(I18nKeys.errors.unknown_error);
}
