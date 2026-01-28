import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

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
