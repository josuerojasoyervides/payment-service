import type {
  PaymentErrorCode,
  PaymentErrorParams,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';

/**
 * Domain-level error contract.
 *
 * Rules:
 * - `messageKey` is an opaque identifier for UI copy (Domain does not define the catalog).
 * - `params` are optional and should be clean (no `undefined` values).
 * - `raw` is never meant to be rendered directly; it is for diagnostics only.
 */
export interface PaymentError {
  code: PaymentErrorCode;
  messageKey?: string;
  params?: PaymentErrorParams;
  raw: unknown;
}
