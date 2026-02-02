import type { NextAction } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ProviderRefs } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';
import type { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import type { Money } from '@payments/domain/common/primitives/money/money.vo';

export {
  CURRENCY_CODES,
  type CurrencyCode,
} from '@payments/domain/common/primitives/money/currency.types';

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

export interface PaymentIntent {
  id: PaymentIntentId;
  provider: PaymentProviderId;

  status: PaymentIntentStatus;
  money: Money;

  clientSecret?: string;
  redirectUrl?: string;
  nextAction?: NextAction;
  finalizeRequired?: boolean;
  providerRefs?: ProviderRefs;

  raw?: unknown;
}
