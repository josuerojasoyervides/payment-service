import { I18nKeys, I18nService } from '@core/i18n';

type KeyParams = Record<string, string | number>;

interface MaybePaymentError {
  message?: string;
  messageKey?: string;
  params?: KeyParams;
}

interface MaybeValidationError {
  messageKey?: string;
  params?: KeyParams;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function looksLikeI18nKey(value: string): boolean {
  // Keys tipo: "errors.provider_error", "ui.payment_problem"
  return value.includes('.') && !value.includes(' ');
}

export function renderPaymentError(i18n: I18nService, error: unknown): string {
  if (!error) return i18n.t(I18nKeys.ui.unknown_error);

  // Validation error (tu PaymentValidationError)
  if (isObject(error) && 'messageKey' in error) {
    const validationError = error as MaybeValidationError;

    if (typeof validationError.messageKey === 'string') {
      return i18n.t(validationError.messageKey, validationError.params);
    }
  }

  // PaymentError-like
  if (isObject(error) && ('messageKey' in error || 'message' in error)) {
    const paymentError = error as MaybePaymentError;

    if (typeof paymentError.messageKey === 'string') {
      return i18n.t(paymentError.messageKey, paymentError.params);
    }

    if (typeof paymentError.message === 'string') {
      // Si message parece key -> traducir
      if (looksLikeI18nKey(paymentError.message)) {
        return i18n.t(paymentError.message, paymentError.params);
      }

      // Si no parece key -> texto legacy
      return paymentError.message;
    }
  }

  return i18n.t(I18nKeys.ui.unknown_error);
}
