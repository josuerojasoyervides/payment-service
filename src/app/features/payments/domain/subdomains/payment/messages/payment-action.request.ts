import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

/**
 * Base request for post-authorization actions (refund/capture/void).
 */
export interface PaymentActionRequest {
  intentId: string;
  providerId: PaymentProviderId;
  idempotencyKey: string;
}
