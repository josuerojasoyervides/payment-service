import { NextAction } from './payment-action.types';

export type PaymentProviderId = 'stripe' | 'paypal';
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
  raw?: unknown;
}
