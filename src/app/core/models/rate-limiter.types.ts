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
 * Configuración por defecto del Rate Limiter.
 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
    maxRequests: 100,
    windowMs: 60000,           // 1 minuto
    perEndpoint: true,
};
