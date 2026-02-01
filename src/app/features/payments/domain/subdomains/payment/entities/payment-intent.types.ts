import type { NextAction } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ProviderRefs } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';

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
