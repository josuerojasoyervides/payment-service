import type { CurrencyCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { createPaymentError } from '@payments/domain/subdomains/payment/factories/payment-error.factory';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

import type { ProviderValidationConfig } from './provider-validation-config.types';

const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;

const STRIPE_CARD_LIMITS: Partial<Record<CurrencyCode, { min: number; max: number }>> = {
  MXN: { min: 10, max: MAX_SAFE_AMOUNT },
  USD: { min: 1, max: MAX_SAFE_AMOUNT },
};

const STRIPE_SPEI_LIMITS: Partial<Record<CurrencyCode, { min: number; max: number }>> = {
  MXN: { min: 1, max: 8_000_000 },
};

const PAYPAL_CARD_LIMITS: Partial<Record<CurrencyCode, { min: number; max: number }>> = {
  MXN: { min: 10, max: MAX_SAFE_AMOUNT },
  USD: { min: 1, max: MAX_SAFE_AMOUNT },
};

export const STRIPE_CARD_VALIDATION_CONFIG: ProviderValidationConfig = {
  providerId: PAYMENT_PROVIDER_IDS.stripe,
  method: 'card',
  currencies: ['MXN', 'USD'],
  amountLimitsByCurrency: STRIPE_CARD_LIMITS,
};

export const STRIPE_SPEI_VALIDATION_CONFIG: ProviderValidationConfig = {
  providerId: PAYMENT_PROVIDER_IDS.stripe,
  method: 'spei',
  currencies: ['MXN'],
  amountLimitsByCurrency: STRIPE_SPEI_LIMITS,
};

export const PAYPAL_CARD_VALIDATION_CONFIG: ProviderValidationConfig = {
  providerId: PAYMENT_PROVIDER_IDS.paypal,
  method: 'card',
  currencies: ['MXN', 'USD'],
  amountLimitsByCurrency: PAYPAL_CARD_LIMITS,
  urls: {
    returnUrlRequired: true,
    cancelUrlRequired: false,
  },
};

const CONFIG_BY_PROVIDER: Record<
  PaymentProviderId,
  Partial<Record<PaymentMethodType, ProviderValidationConfig>>
> = {
  [PAYMENT_PROVIDER_IDS.stripe]: {
    card: STRIPE_CARD_VALIDATION_CONFIG,
    spei: STRIPE_SPEI_VALIDATION_CONFIG,
  },
  [PAYMENT_PROVIDER_IDS.paypal]: {
    card: PAYPAL_CARD_VALIDATION_CONFIG,
  },
};

export function getProviderValidationConfig(
  providerId: PaymentProviderId,
  method: PaymentMethodType,
): ProviderValidationConfig {
  const providerConfigs = CONFIG_BY_PROVIDER[providerId];
  const config = providerConfigs?.[method];

  if (!config) {
    throw createPaymentError('invalid_request', undefined, {
      reason: 'validation_config_missing',
      providerId,
      method,
    });
  }

  return config;
}
