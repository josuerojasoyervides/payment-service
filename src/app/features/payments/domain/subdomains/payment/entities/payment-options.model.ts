import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';

/**
 * Generic options for the builder.
 *
 * Contains ALL possible fields that any provider might need.
 * Each specific builder uses what it needs and validates required ones.
 */
export interface PaymentOptions {
  token?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
  saveForFuture?: boolean;
  description?: string;
  createdAt?: Date;
  paymentMethodTypes?: PaymentMethodType[];
}
