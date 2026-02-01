import type { FallbackAvailableEvent } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-event.model';
import type { FallbackStatus } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-statuses.types';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export interface FailedAttempt {
  providerId: PaymentProviderId;
  error: PaymentError;
  timestamp: number;
  wasAutoFallback: boolean;
}

export interface FallbackState {
  status: FallbackStatus;
  pendingEvent: FallbackAvailableEvent | null;
  failedAttempts: FailedAttempt[];
  currentProvider: PaymentProviderId | null;
  isAutoFallback: boolean;
  originalRequest: CreatePaymentRequest | null;
}

export const INITIAL_FALLBACK_STATE: FallbackState = {
  status: 'idle',
  pendingEvent: null,
  failedAttempts: [],
  currentProvider: null,
  isAutoFallback: false,
  originalRequest: null,
};
