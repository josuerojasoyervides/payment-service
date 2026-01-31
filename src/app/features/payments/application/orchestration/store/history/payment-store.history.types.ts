import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';

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
