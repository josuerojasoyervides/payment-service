import { PaymentProviderId } from '../payment/payment-intent.types';
import { PaymentError } from '../payment/payment-error.types';
import { FallbackAvailableEvent } from './fallback-event.types';

/**
 * Estado del proceso de fallback.
 */
export type FallbackStatus = 
    | 'idle'           // No hay fallback pendiente
    | 'pending'        // Esperando respuesta del usuario
    | 'executing'      // Ejecutando fallback (manual)
    | 'auto_executing' // Ejecutando fallback automáticamente
    | 'completed'      // Fallback completado exitosamente
    | 'cancelled'      // Usuario canceló el fallback
    | 'failed';        // Fallback también falló

/**
 * Modo de operación del fallback.
 */
export type FallbackMode = 'manual' | 'auto';

/**
 * Información de un intento fallido de pago.
 */
export interface FailedAttempt {
    /** Provider que falló */
    provider: PaymentProviderId;
    
    /** Error que causó el fallo */
    error: PaymentError;
    
    /** Timestamp del fallo */
    timestamp: number;
    
    /** Si este intento fue un auto-fallback */
    wasAutoFallback: boolean;
}

/**
 * Estado completo del sistema de fallback.
 */
export interface FallbackState {
    /** Estado actual */
    status: FallbackStatus;
    
    /** Evento pendiente (si status es 'pending') */
    pendingEvent: FallbackAvailableEvent | null;
    
    /** Historial de intentos fallidos en el flujo actual */
    failedAttempts: FailedAttempt[];
    
    /** Provider actualmente en ejecución */
    currentProvider: PaymentProviderId | null;
    
    /** Si el fallback actual es automático */
    isAutoFallback: boolean;
}

/**
 * Estado inicial del fallback.
 */
export const INITIAL_FALLBACK_STATE: FallbackState = {
    status: 'idle',
    pendingEvent: null,
    failedAttempts: [],
    currentProvider: null,
    isAutoFallback: false,
};
