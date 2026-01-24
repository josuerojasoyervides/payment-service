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

  /** provider destino (al que se intentará el fallback) */
  provider: PaymentProviderId;

  /** provider que falló y detonó el fallback */
  fromProvider: PaymentProviderId;

  /** correlación del flow completo */
  eventId: string;

  /** true si fue auto, false si fue manual */
  wasAutoFallback: boolean;
}

export interface AutoFallbackStartedPayload {
  provider: PaymentProviderId;
  delay: number;

  fromProvider: PaymentProviderId;
  eventId: string;

  wasAutoFallback: true;
}
