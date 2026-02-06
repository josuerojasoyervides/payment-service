import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';

export interface ReportFailurePayload {
  providerId: PaymentProviderId;
  error: PaymentError;
  request: CreatePaymentRequest;
  wasAutoFallback?: boolean;
}

export type FinishStatus = 'completed' | 'cancelled' | 'failed';

export interface FallbackExecutePayload {
  request: CreatePaymentRequest;

  /** Target provider (fallback destination) */
  provider: PaymentProviderId;

  /** Provider that failed and triggered fallback */
  fromProvider: PaymentProviderId;

  /** Correlation for the full flow */
  eventId: string;

  /** True if auto, false if manual */
  wasAutoFallback: boolean;
}

export interface AutoFallbackStartedPayload {
  provider: PaymentProviderId;
  delay: number;

  fromProvider: PaymentProviderId;
  eventId: string;

  wasAutoFallback: true;
}
