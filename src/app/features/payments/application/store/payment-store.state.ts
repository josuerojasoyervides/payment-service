import {
  FallbackState,
  INITIAL_FALLBACK_STATE,
} from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import { PaymentHistoryEntry } from './payment-store.history.types';

/**
 * Estados posibles del flujo de pago en la UI.
 */
export type PaymentFlowStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Estado principal del módulo de pagos.
 */
export interface PaymentsState {
  /** Estado actual del pago */
  status: PaymentFlowStatus;

  /** Intent del pago actual (si existe) */
  intent: PaymentIntent | null;

  /** Error actual (si existe) */
  error: PaymentError | null;

  /** Provider actualmente seleccionado */
  selectedProvider: PaymentProviderId | null;

  /** Request actual en proceso */
  currentRequest: CreatePaymentRequest | null;

  /** Estado del sistema de fallback */
  fallback: FallbackState;

  /** Historial de intents para debugging */
  history: PaymentHistoryEntry[];
}

/**
 * Estado inicial del store de pagos.
 */
export const initialPaymentsState: PaymentsState = {
  status: 'idle',
  intent: null,
  error: null,
  selectedProvider: null,
  currentRequest: null,
  fallback: INITIAL_FALLBACK_STATE,
  history: [],
};
