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
 * Información de rate limiting para un endpoint.
 */
export interface RateLimitInfo {
    /** Número de requests en la ventana actual */
    requestCount: number;
    
    /** Timestamp de inicio de la ventana */
    windowStart: number;
    
    /** Timestamp del último request */
    lastRequest: number;
}

/**
 * Configuración del Rate Limiter.
 */
export interface RateLimiterConfig {
    /** Máximo de requests por ventana de tiempo */
    maxRequests: number;
    
    /** Duración de la ventana en ms (default: 60000 = 1 min) */
    windowMs: number;
    
    /** Si aplicar por endpoint individual o globalmente */
    perEndpoint: boolean;
}

/**
 * Configuración del Retry con backoff exponencial.
 * 
 * Re-exportada desde retry.types.ts para conveniencia.
 */
export type { RetryConfig } from './retry.types';
export { DEFAULT_RETRY_CONFIG } from './retry.types';
import type { RetryConfig } from './retry.types';
import { DEFAULT_RETRY_CONFIG } from './retry.types';

/**
 * Configuración del Cache HTTP.
 * 
 * Re-exportada desde cache.types.ts para conveniencia.
 */
export type { CacheConfig } from './cache.types';
export { DEFAULT_CACHE_CONFIG } from './cache.types';
import type { CacheConfig } from './cache.types';
import { DEFAULT_CACHE_CONFIG } from './cache.types';

/**
 * Configuración completa de resiliencia.
 */
export interface ResilienceConfig {
    /** Si habilitar circuit breaker */
    enableCircuitBreaker: boolean;
    
    /** Si habilitar rate limiting */
    enableRateLimiting: boolean;
    
    /** Si habilitar retry automático */
    enableRetry: boolean;
    
    /** Si habilitar caching de respuestas */
    enableCaching: boolean;
    
    /** Configuración del circuit breaker */
    circuitBreaker: CircuitBreakerConfig;
    
    /** Configuración del rate limiter */
    rateLimiter: RateLimiterConfig;
    
    /** Configuración del retry */
    retry: RetryConfig;
    
    /** Configuración del cache */
    cache: CacheConfig;
    
    /** Patrones de URL a excluir de la resiliencia */
    excludePatterns: RegExp[];
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
 * Error lanzado cuando se excede el rate limit.
 */
export class RateLimitExceededError extends Error {
    constructor(
        public readonly endpoint: string,
        public readonly retryAfter: number
    ) {
        super(`Rate limit exceeded for endpoint: ${endpoint}. Retry after ${retryAfter}ms`);
        this.name = 'RateLimitExceededError';
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

/**
 * Configuración por defecto del Rate Limiter.
 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
    maxRequests: 100,
    windowMs: 60000,           // 1 minuto
    perEndpoint: true,
};

/**
 * Configuración por defecto de resiliencia.
 */
export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
    enableCircuitBreaker: true,
    enableRateLimiting: true,
    enableRetry: true,
    enableCaching: true,
    circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
    rateLimiter: DEFAULT_RATE_LIMITER_CONFIG,
    retry: DEFAULT_RETRY_CONFIG,
    cache: DEFAULT_CACHE_CONFIG,
    excludePatterns: [
        /\/health$/,           // Health checks
        /\/metrics$/,          // Metrics
        /\.json$/,             // Static JSON files
    ],
};
