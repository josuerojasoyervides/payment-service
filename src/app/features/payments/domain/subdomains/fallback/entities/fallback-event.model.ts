import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { PaymentError } from '@payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

/**
 * Domain-level fallback events emitted by the fallback workflow.
 * These are pure data shapes meant to be transported across layers.
 *
 * Time values are epoch milliseconds.
 */
export interface FallbackAvailableEvent {
  eventId: string;

  failedProvider: PaymentProviderId;
  error: PaymentError;

  alternativeProviders: PaymentProviderId[];
  originalRequest: CreatePaymentRequest;

  timestamp: number;
}

export interface FallbackUserResponse {
  eventId: string;

  accepted: boolean;
  selectedProvider?: PaymentProviderId;

  timestamp: number;
}
