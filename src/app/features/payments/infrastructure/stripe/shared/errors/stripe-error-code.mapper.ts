import type { PaymentErrorCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import { STRIPE_ERROR_CODE_MAP } from '@app/features/payments/infrastructure/stripe/shared/errors/stripe-error-code.map';

export function mapStripeCodeToPaymentErrorCode(
  stripeCode: string | null | undefined,
): PaymentErrorCode | null {
  if (!stripeCode) return null;
  return STRIPE_ERROR_CODE_MAP[stripeCode as keyof typeof STRIPE_ERROR_CODE_MAP] ?? null;
}
