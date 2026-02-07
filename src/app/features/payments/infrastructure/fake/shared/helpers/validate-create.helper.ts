import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { CURRENCY_CODES } from '@payments/domain/common/primitives/money/currency.types';
import { PAYMENT_METHOD_TYPES } from '@payments/domain/subdomains/payment/entities/payment-method.types';
import { getProviderValidationConfig } from '@payments/infrastructure/shared/validation/provider-validation.config';
import { validateAmount } from '@payments/infrastructure/shared/validation/validate-amount';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { z } from 'zod';

const CreatePaymentRequestSchema = z.object({
  orderId: z.object({ value: z.string().min(1) }),
  money: z.object({
    amount: z.number(),
    currency: z.enum(CURRENCY_CODES),
  }),
  method: z.object({
    type: z.enum(PAYMENT_METHOD_TYPES),
    token: z.string().optional(),
  }),
  returnUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
  customerEmail: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function validateCreate(req: CreatePaymentRequest, providerId: PaymentProviderId) {
  CreatePaymentRequestSchema.safeParse(req);

  if (!req.orderId)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.ORDER_ID_REQUIRED, { field: 'orderId' });
  if (!req.money?.currency)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.CURRENCY_REQUIRED, { field: 'currency' });
  if (!Number.isFinite(req.money?.amount) || req.money.amount <= 0)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.AMOUNT_INVALID, { field: 'amount' });
  if (!req.method?.type)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.METHOD_TYPE_REQUIRED, {
      field: 'method.type',
    });

  const config = getProviderValidationConfig(providerId, req.method.type);
  validateAmount(req.money, config);

  if (providerId === PAYMENT_PROVIDER_IDS.paypal) return;
  if (req.method.type === 'card' && !req.method.token)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.CARD_TOKEN_REQUIRED, { field: 'method.token' });
}
