import type { FallbackAvailableEvent } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-event.model';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { PaymentError } from '@payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export const FALLBACK_STATUSES = [
  'idle',
  'pending',
  'executing',
  'auto_executing',
  'completed',
  'cancelled',
  'failed',
] as const;

export type FallbackStatus = (typeof FALLBACK_STATUSES)[number];

export const FALLBACK_MODES = ['manual', 'auto'] as const;
export type FallbackMode = (typeof FALLBACK_MODES)[number];

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
