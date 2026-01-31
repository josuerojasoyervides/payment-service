export const PAYMENT_METHOD_TYPES = ['card', 'spei'] as const;
export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export interface PaymentCardSummary {
  brand: string;
  last4: string;
}

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  card?: PaymentCardSummary;
}
