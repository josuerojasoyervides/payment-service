import { PaymentProviderId } from '../payment/payment-intent.types';
import { PaymentError } from '../payment/payment-error.types';
import { CreatePaymentRequest } from '../payment/payment-request.types';

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
