import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

export interface ReportFailurePayload {
  providerId: PaymentProviderId;
  error: PaymentError;
  request: CreatePaymentRequest;
  wasAutoFallback?: boolean;
}

export type FinishStatus = 'completed' | 'cancelled' | 'failed';

export interface FallbackExecutePayload {
  request: CreatePaymentRequest;
  provider: PaymentProviderId;
}

export interface AutoFallbackStartedPayload {
  provider: PaymentProviderId;
  delay: number;
}
