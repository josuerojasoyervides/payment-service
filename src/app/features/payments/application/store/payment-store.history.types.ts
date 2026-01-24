import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

/**
 * Configuración del historial.
 */
export const HISTORY_MAX_ENTRIES = 10;

/**
 * Entrada del historial de pagos.
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
