import type { NextAction } from '@payments/domain/subdomains/payment/contracts/payment-action.types';
import type { ProviderRefs } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';

export const PAYMENT_PROVIDER_IDS = ['stripe', 'paypal'] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];
export type PaymentMethodType = 'card' | 'spei';

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'processing';

export type CurrencyCode = 'MXN' | 'USD';

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
