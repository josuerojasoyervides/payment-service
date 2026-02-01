import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type {
  PaymentErrorCode,
  PaymentErrorMessageKey,
  PaymentErrorParams,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';

export function createPaymentError<TKey extends PaymentErrorMessageKey = PaymentErrorMessageKey>(
  code: PaymentErrorCode,
  messageKey: TKey,
  params?: PaymentErrorParams,
  raw?: unknown,
): PaymentError<TKey> {
  return {
    code,
    messageKey,
    ...(params ? { params } : {}),
    ...(raw !== undefined ? { raw } : { raw: undefined }),
  };
}

export function invalidRequestError<TKey extends PaymentErrorMessageKey = PaymentErrorMessageKey>(
  messageKey: TKey,
  params?: PaymentErrorParams,
  raw?: unknown,
): PaymentError<TKey> {
  return createPaymentError('invalid_request', messageKey, params, raw);
}
