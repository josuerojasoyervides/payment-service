import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  card?: {
    brand: string;
    last4: string;
  };
}
