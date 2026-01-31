import type { NextAction } from '@payments/domain/subdomains/payment/contracts/payment-action.types';
import type { ProviderRefs } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';

export const PAYMENT_PROVIDER_IDS = ['stripe', 'paypal'] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export const PAYMENT_METHOD_TYPES = ['card', 'spei'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export const PAYMENT_INTENT_STATUSES = [
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'succeeded',
  'failed',
  'canceled',
  'processing',
] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const CURRENCY_CODES = ['MXN', 'USD'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface PaymentIntent {
  id: string;
  provider: PaymentProviderId;

  status: PaymentIntentStatus;
  amount: number;
  currency: CurrencyCode;

  clientSecret?: string;
  redirectUrl?: string;
  nextAction?: NextAction;
  finalizeRequired?: boolean;
  providerRefs?: ProviderRefs;

  raw?: unknown;
}
