/**
 * Estados posibles del Circuit Breaker.
 * 
 * - closed: Operación normal, las llamadas pasan
 * - open: Circuito abierto, las llamadas se rechazan inmediatamente
 * - half-open: Estado de prueba, permite una llamada para verificar recuperación
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Información del estado de un circuito específico.
 */
export interface CircuitInfo {
    /** Estado actual del circuito */
    state: CircuitState;
    
    /** Contador de fallos consecutivos */
    failures: number;
    
    /** Timestamp del último fallo */
    lastFailure: number;
    
    /** Timestamp de cuando se abrió el circuito */
    openedAt?: number;
    
    /** Contador de éxitos consecutivos (en half-open) */
    successes: number;
}

/**
 * Configuración del Circuit Breaker.
 */
export interface CircuitBreakerConfig {
    /** Número de fallos antes de abrir el circuito (default: 5) */
    failureThreshold: number;
    
    /** Tiempo en ms para considerar un fallo como "reciente" (default: 30000) */
    failureWindow: number;
    
    /** Tiempo en ms antes de intentar half-open (default: 60000) */
    resetTimeout: number;
    
    /** Número de éxitos en half-open para cerrar el circuito (default: 2) */
    successThreshold: number;
    
    /** Códigos de status HTTP que cuentan como fallo (default: 5xx) */
    failureStatusCodes: number[];
}

/**
 * Error lanzado cuando el circuito está abierto.
 */
export class CircuitOpenError extends Error {
    constructor(
        public readonly endpoint: string,
        public readonly circuitInfo: CircuitInfo
    ) {
        super(`Circuit breaker is open for endpoint: ${endpoint}`);
        this.name = 'CircuitOpenError';
    }
}

/**
 * Configuración por defecto del Circuit Breaker.
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    failureWindow: 30000,      // 30 segundos
    resetTimeout: 60000,       // 1 minuto
    successThreshold: 2,
    failureStatusCodes: [500, 502, 503, 504],
};
