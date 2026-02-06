import type { Money } from '@payments/domain/common/primitives/money/money.vo';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export interface RefundResult {
  intentId: string;
  providerId: PaymentProviderId;
  status: 'succeeded' | 'pending' | 'failed';
  amount?: Money;
}
