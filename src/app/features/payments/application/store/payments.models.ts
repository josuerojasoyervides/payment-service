import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { PaymentError } from '../../domain/models/payment.errors';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';
import { FallbackState, INITIAL_FALLBACK_STATE } from '../../domain/models/fallback.types';

/**
 * Estados posibles del flujo de pago.
 */
export type PaymentStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Estado principal del módulo de pagos.
 */
export interface PaymentsState {
    /** Estado actual del pago */
    status: PaymentStatus;
    
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
 * Entrada del historial de pagos.
 */
export interface PaymentHistoryEntry {
    intentId: string;
    provider: PaymentProviderId;
    status: string;
    amount: number;
    currency: string;
    timestamp: number;
    error?: PaymentError;
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

/**
 * Configuración del historial.
 */
export const HISTORY_MAX_ENTRIES = 10;
