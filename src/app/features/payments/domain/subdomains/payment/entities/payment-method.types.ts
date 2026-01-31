import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';

export interface PaymentCardSummary {
  brand: string;
  last4: string;
}

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  card?: PaymentCardSummary;
}
