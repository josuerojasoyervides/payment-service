import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

export interface RedirectReturnedPayload {
  providerId: PaymentProviderId;
  referenceId: string;
  /**
   * Optional nonce to deduplicate multiple returns for the same redirect.
   * If omitted, the machine will fall back to using `referenceId` as the nonce.
   */
  returnNonce?: string;
}
