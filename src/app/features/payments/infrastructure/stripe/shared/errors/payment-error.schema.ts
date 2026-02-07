import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import { PAYMENT_ERROR_CODES } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import { z } from 'zod';

export const PaymentErrorCodeSchema = z.enum(PAYMENT_ERROR_CODES);

export const PaymentErrorSchema = z
  .object({
    code: PaymentErrorCodeSchema,
    messageKey: z.string().optional(),
    raw: z.unknown().optional(),
    params: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional(),
  })
  .passthrough();

export function isPaymentErrorLike(value: unknown): value is PaymentError {
  return PaymentErrorSchema.safeParse(value).success;
}
