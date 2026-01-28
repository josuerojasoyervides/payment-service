import type { PaymentMethodType } from './payment-intent.types';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  card?: {
    brand: string;
    last4: string;
  };
}
