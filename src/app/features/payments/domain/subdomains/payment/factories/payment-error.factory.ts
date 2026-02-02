import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type {
  PaymentErrorCode,
  PaymentErrorParams,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';

export function createPaymentError(
  code: PaymentErrorCode,
  messageKey: string,
  params?: PaymentErrorParams,
  raw?: unknown,
): PaymentError {
  return {
    code,
    messageKey,
    ...(params ? { params } : {}),
    ...(raw !== undefined ? { raw } : { raw: undefined }),
  };
}

export function invalidRequestError(
  messageKey: string,
  params?: PaymentErrorParams,
  raw?: unknown,
): PaymentError {
  return createPaymentError('invalid_request', messageKey, params, raw);
}
