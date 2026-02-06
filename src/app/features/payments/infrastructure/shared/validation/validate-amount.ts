import type { Money } from '@payments/domain/common/primitives/money/money.vo';
import { createPaymentError } from '@payments/domain/subdomains/payment/factories/payment-error.factory';

import type { ProviderValidationConfig } from './provider-validation-config.types';

export function validateAmount(money: Money, config: ProviderValidationConfig): void {
  const currency = money?.currency;
  const amount = money?.amount ?? NaN;

  if (!currency || !config.currencies.includes(currency)) {
    throw createPaymentError('currency_not_supported', undefined, {
      currency,
      providerId: config.providerId,
      method: config.method,
      supportedCount: config.currencies.length,
    });
  }

  const limits = config.amountLimitsByCurrency[currency];
  if (!limits || !Number.isFinite(limits.min) || !Number.isFinite(limits.max)) {
    throw createPaymentError('invalid_request', undefined, {
      reason: 'validation_config_invalid',
      currency,
      providerId: config.providerId,
      method: config.method,
    });
  }

  if (!Number.isFinite(amount)) {
    throw createPaymentError('invalid_request', undefined, {
      reason: 'amount_not_finite',
      amount,
      currency,
    });
  }

  if (amount < limits.min) {
    throw createPaymentError('amount_below_minimum', undefined, {
      amount: limits.min,
      currency,
    });
  }

  if (amount > limits.max) {
    throw createPaymentError('amount_above_maximum', undefined, {
      amount: limits.max,
      currency,
    });
  }
}
