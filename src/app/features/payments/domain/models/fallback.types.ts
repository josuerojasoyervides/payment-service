import { PaymentProviderId } from './payment.types';
import { PaymentError } from './payment.errors';
import { CreatePaymentRequest } from './payment.requests';

/**
 * Evento emitido cuando hay alternativas de fallback disponibles.
 * 
 * La UI puede escuchar este evento para mostrar opciones al usuario.
 */
export interface FallbackAvailableEvent {
    /** Provider que falló */
    failedProvider: PaymentProviderId;
    
    /** Error que causó el fallo */
    error: PaymentError;
    
    /** Lista de providers alternativos disponibles */
    alternativeProviders: PaymentProviderId[];
    
    /** Request original que falló */
    originalRequest: CreatePaymentRequest;
    
    /** Timestamp del evento */
    timestamp: number;
    
    /** ID único del evento para tracking */
    eventId: string;
}

/**
 * Respuesta del usuario al evento de fallback.
 */
export interface FallbackUserResponse {
    /** ID del evento al que responde */
    eventId: string;
    
    /** Si el usuario aceptó el fallback */
    accepted: boolean;
    
    /** Provider seleccionado (si accepted es true) */
    selectedProvider?: PaymentProviderId;
    
    /** Timestamp de la respuesta */
    timestamp: number;
}

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
 * Configuración del sistema de fallback.
 */
export interface FallbackConfig {
    /** Si el fallback está habilitado */
    enabled: boolean;
    
    /** Máximo número de intentos de fallback */
    maxAttempts: number;
    
    /** Tiempo máximo de espera por respuesta del usuario (ms) */
    userResponseTimeout: number;
    
    /** Códigos de error que activan fallback */
    triggerErrorCodes: string[];
    
    /** Providers en orden de preferencia para fallback */
    providerPriority: PaymentProviderId[];
    
    /** Modo de fallback: 'manual' requiere confirmación del usuario, 'auto' ejecuta automáticamente */
    mode: FallbackMode;
    
    /** Delay antes de ejecutar fallback automático (ms) - solo aplica en modo 'auto' */
    autoFallbackDelay: number;
    
    /** Máximo número de fallbacks automáticos antes de requerir intervención manual */
    maxAutoFallbacks: number;
}

/**
 * Configuración por defecto del fallback.
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
    enabled: true,
    maxAttempts: 2,
    userResponseTimeout: 30000, // 30 segundos
    triggerErrorCodes: [
        'provider_unavailable',
        'provider_error',
        'network_error',
        'timeout',
    ],
    providerPriority: ['stripe', 'paypal'],
    mode: 'manual',           // Comportamiento actual por defecto
    autoFallbackDelay: 2000,  // 2 segundos de delay antes del auto-fallback
    maxAutoFallbacks: 1,      // Solo 1 auto-fallback, luego requiere intervención
};

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
