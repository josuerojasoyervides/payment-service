import { PaymentProviderId } from '../payment/payment-intent.types';
import { FallbackMode } from './fallback-state.types';

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
