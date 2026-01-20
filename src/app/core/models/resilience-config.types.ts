import { CircuitBreakerConfig, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker.types';
import { RateLimiterConfig, DEFAULT_RATE_LIMITER_CONFIG } from './rate-limiter.types';
import { RetryConfig, DEFAULT_RETRY_CONFIG } from './retry.types';
import { CacheConfig, DEFAULT_CACHE_CONFIG } from './cache.types';

// Re-exports para conveniencia
export type { CircuitState, CircuitInfo, CircuitBreakerConfig } from './circuit-breaker.types';
export { CircuitOpenError, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker.types';

export type { RateLimitInfo, RateLimiterConfig } from './rate-limiter.types';
export { RateLimitExceededError, DEFAULT_RATE_LIMITER_CONFIG } from './rate-limiter.types';

export type { RetryConfig } from './retry.types';
export { DEFAULT_RETRY_CONFIG } from './retry.types';

export type { CacheConfig } from './cache.types';
export { DEFAULT_CACHE_CONFIG } from './cache.types';

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
