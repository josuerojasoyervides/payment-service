import type { PaymentMethodType } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  card?: {
    brand: string;
    last4: string;
  };
}
