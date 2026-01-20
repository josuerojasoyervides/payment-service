import { CircuitBreakerConfig, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker';
import { RateLimiterConfig, DEFAULT_RATE_LIMITER_CONFIG } from './rate-limiter';
import { RetryConfig, DEFAULT_RETRY_CONFIG } from './retry';

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
    
    /** Configuración del circuit breaker */
    circuitBreaker: CircuitBreakerConfig;
    
    /** Configuración del rate limiter */
    rateLimiter: RateLimiterConfig;
    
    /** Configuración del retry */
    retry: RetryConfig;
    
    /** Patrones de URL a excluir de la resiliencia */
    excludePatterns: RegExp[];
}

/**
 * Configuración por defecto de resiliencia.
 */
export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
    enableCircuitBreaker: true,
    enableRateLimiting: true,
    enableRetry: true,
    circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
    rateLimiter: DEFAULT_RATE_LIMITER_CONFIG,
    retry: DEFAULT_RETRY_CONFIG,
    excludePatterns: [
        /\/health$/,           // Health checks
        /\/metrics$/,          // Metrics
        /\.json$/,             // Static JSON files
    ],
};
