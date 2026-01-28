import type { PaymentMethodType } from '@payments/domain/models/payment/payment-intent.types';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  card?: {
    brand: string;
    last4: string;
  };
}
