import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
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
