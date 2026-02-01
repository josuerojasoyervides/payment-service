import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

export interface FallbackUserResponse {
  eventId: string;

  accepted: boolean;
  selectedProvider?: PaymentProviderId;

  timestamp: number;
}
