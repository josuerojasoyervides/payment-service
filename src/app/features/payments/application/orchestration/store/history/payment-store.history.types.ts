import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

/**
 * History configuration.
 */
export const HISTORY_MAX_ENTRIES = 10;

/**
 * Payment history entry.
 */
export interface PaymentHistoryEntry {
  intentId: string;
  provider: PaymentProviderId;
  status: PaymentIntent['status'];
  amount: number;
  currency: PaymentIntent['currency'];
  timestamp: number;
  error?: PaymentError;
}
