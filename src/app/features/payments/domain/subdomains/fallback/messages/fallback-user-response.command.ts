import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

/**
 * User response to a fallback offer (command - intent from user, not an event).
 */
export interface FallbackUserResponse {
  eventId: string;

  accepted: boolean;
  selectedProvider?: PaymentProviderId;

  timestamp: number;
}
