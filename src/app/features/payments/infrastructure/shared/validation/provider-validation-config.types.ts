import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { CURRENCY_CODES } from '@payments/domain/common/primitives/money/currency.types';
import { PAYMENT_METHOD_TYPES } from '@payments/domain/subdomains/payment/entities/payment-method.types';
import { z } from 'zod';

export interface AmountLimitsByCurrency {
  min: number;
  max: number;
}

export interface ProviderValidationConfig {
  providerId: PaymentProviderId;
  method: PaymentMethodType;
  currencies: CurrencyCode[];
  amountLimitsByCurrency: Partial<Record<CurrencyCode, AmountLimitsByCurrency>>;
  urls?: {
    returnUrlRequired?: boolean;
    cancelUrlRequired?: boolean;
  };
}

export const AmountLimitsByCurrencySchema = z.object({
  min: z.number(),
  max: z.number(),
});

export const ProviderValidationConfigSchema = z.object({
  providerId: z.string(),
  method: z.enum(PAYMENT_METHOD_TYPES),
  currencies: z.array(z.enum(CURRENCY_CODES)),
  amountLimitsByCurrency: z.record(z.string(), AmountLimitsByCurrencySchema),
  urls: z
    .object({
      returnUrlRequired: z.boolean().optional(),
      cancelUrlRequired: z.boolean().optional(),
    })
    .optional(),
});
