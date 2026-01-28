import type { PaymentError, PaymentErrorCode, PaymentErrorParams } from './payment-error.types';

export function createPaymentError(
  code: PaymentErrorCode,
  messageKey: string,
  params?: PaymentErrorParams,
  raw: unknown = null,
): PaymentError {
  return { code, messageKey, params, raw };
}

export function invalidRequestError(
  messageKey: string,
  params?: PaymentErrorParams,
  raw: unknown = null,
): PaymentError {
  return createPaymentError('invalid_request', messageKey, params, raw);
}
