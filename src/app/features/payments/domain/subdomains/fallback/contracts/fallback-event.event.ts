import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

/**
 * Event emitted when fallback alternatives are available.
 *
 * The UI can listen to this event to show options to the user.
 */
export interface FallbackAvailableEvent {
  /** Provider that failed */
  failedProvider: PaymentProviderId;

  /** Error that caused the failure */
  error: PaymentError;

  /** List of available alternative providers */
  alternativeProviders: PaymentProviderId[];

  /** Original request that failed */
  originalRequest: CreatePaymentRequest;

  /** Event timestamp */
  timestamp: number;

  /** Unique event ID for tracking */
  eventId: string;
}

/**
 * User response to fallback event.
 */
export interface FallbackUserResponse {
  /** ID of the event being responded to */
  eventId: string;

  /** Whether user accepted the fallback */
  accepted: boolean;

  /** Selected provider (if accepted is true) */
  selectedProvider?: PaymentProviderId;

  /** Response timestamp */
  timestamp: number;
}
