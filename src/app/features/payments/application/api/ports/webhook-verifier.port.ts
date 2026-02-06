import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

/**
 * Port for backend webhook signature verification.
 *
 * Implementations should verify provider-specific signatures using the raw
 * payload and headers and return true only when the signature is valid.
 */
export interface WebhookVerifierPort {
  verify(
    providerId: PaymentProviderId,
    payload: unknown,
    headers: Record<string, unknown>,
  ): boolean | Promise<boolean>;
}
