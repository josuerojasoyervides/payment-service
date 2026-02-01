import type {
  PaymentErrorCode,
  PaymentErrorMessageKey,
  PaymentErrorParams,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';

/**
 * Domain-level error contract.
 *
 * Rules:
 * - `messageKey` is the long-term source of truth for UI copy.
 * - `params` are optional and should be clean (no `undefined` values).
 * - `raw` is never meant to be rendered directly; it is for diagnostics only.
 */
export interface PaymentError<TKey extends PaymentErrorMessageKey = PaymentErrorMessageKey> {
  code: PaymentErrorCode;
  messageKey: TKey;
  params?: PaymentErrorParams;
  raw: unknown;
}
