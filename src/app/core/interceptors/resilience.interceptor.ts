import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, catchError, throwError } from 'rxjs';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { RateLimiterService } from '../services/rate-limiter.service';
import { LoggerService } from '../services/logger.service';
import { 
    CircuitOpenError, 
    RateLimitExceededError,
    DEFAULT_RESILIENCE_CONFIG,
} from '../models/resilience.types';

/**
 * Patrones de URL a excluir del circuit breaker y rate limiting.
 */
const EXCLUDE_PATTERNS = DEFAULT_RESILIENCE_CONFIG.excludePatterns;

/**
 * Interceptor de resiliencia que combina Circuit Breaker y Rate Limiting.
 * 
 * Características:
 * - Circuit Breaker: Previene llamadas a servicios fallando
 * - Rate Limiting: Previene exceso de llamadas
 * - Logging integrado para debugging
 * 
 * Orden de verificación:
 * 1. Rate Limiting (si está habilitado)
 * 2. Circuit Breaker (si está habilitado)
 * 3. Request original
 * 4. Registro de resultado (éxito/fallo)
 * 
 * @example
 * ```typescript
 * // En app.config.ts
 * provideHttpClient(
 *   withInterceptors([resilienceInterceptor, loggingInterceptor])
 * )
 * ```
 */
export const resilienceInterceptor: HttpInterceptorFn = (req, next) => {
    const circuitBreaker = inject(CircuitBreakerService);
    const rateLimiter = inject(RateLimiterService);
    const logger = inject(LoggerService);

    const endpoint = req.url;

    // Verificar si debemos excluir esta URL
    if (shouldExclude(endpoint)) {
        return next(req);
    }

    // 1. Verificar Rate Limiting
    try {
        if (!rateLimiter.canRequest(endpoint)) {
            const retryAfter = rateLimiter.getRetryAfter(endpoint);
            const error = new RateLimitExceededError(endpoint, retryAfter);
            
            logger.warn(
                `Rate limit exceeded, rejecting request`,
                'ResilienceInterceptor',
                { endpoint, retryAfter }
            );

            return throwError(() => new HttpErrorResponse({
                error,
                status: 429,
                statusText: 'Too Many Requests',
                url: endpoint,
                headers: req.headers,
            }));
        }
        
        // Registrar el request para rate limiting
        rateLimiter.recordRequest(endpoint);
    } catch (e) {
        if (e instanceof RateLimitExceededError) {
            return throwError(() => new HttpErrorResponse({
                error: e,
                status: 429,
                statusText: 'Too Many Requests',
                url: endpoint,
                headers: req.headers,
            }));
        }
        // Otro error, continuar
    }

    // 2. Verificar Circuit Breaker
    try {
        circuitBreaker.canRequest(endpoint);
    } catch (e) {
        if (e instanceof CircuitOpenError) {
            logger.warn(
                `Circuit is open, rejecting request`,
                'ResilienceInterceptor',
                { 
                    endpoint,
                    circuitState: e.circuitInfo.state,
                    failures: e.circuitInfo.failures,
                }
            );

            return throwError(() => new HttpErrorResponse({
                error: e,
                status: 503,
                statusText: 'Service Unavailable (Circuit Open)',
                url: endpoint,
                headers: req.headers,
            }));
        }
        // Otro error, continuar
    }

    // 3. Ejecutar request y registrar resultado
    return next(req).pipe(
        tap({
            next: () => {
                // Request exitoso, registrar éxito en circuit breaker
                circuitBreaker.recordSuccess(endpoint);
            },
        }),
        catchError((error: HttpErrorResponse) => {
            // Registrar fallo en circuit breaker
            circuitBreaker.recordFailure(endpoint, error.status);

            // Enriquecer el error con información de resiliencia
            const enrichedError = enrichError(error, circuitBreaker, rateLimiter, endpoint);

            return throwError(() => enrichedError);
        })
    );
};

/**
 * Verifica si la URL debe excluirse del procesamiento.
 */
function shouldExclude(url: string): boolean {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Enriquece el error HTTP con información de resiliencia.
 */
function enrichError(
    error: HttpErrorResponse,
    circuitBreaker: CircuitBreakerService,
    rateLimiter: RateLimiterService,
    endpoint: string
): HttpErrorResponse {
    const circuitInfo = circuitBreaker.getCircuitInfo(endpoint);
    const limitInfo = rateLimiter.getLimitInfo(endpoint);

    // Crear nuevo error con metadata adicional
    const enrichedError = new HttpErrorResponse({
        error: {
            ...extractErrorBody(error.error),
            _resilience: {
                circuit: circuitInfo ? {
                    state: circuitInfo.state,
                    failures: circuitInfo.failures,
                } : undefined,
                rateLimit: limitInfo ? {
                    remaining: rateLimiter.getRemainingRequests(endpoint),
                    retryAfter: rateLimiter.getRetryAfter(endpoint),
                } : undefined,
            },
        },
        status: error.status,
        statusText: error.statusText,
        url: error.url ?? undefined,
        headers: error.headers,
    });

    return enrichedError;
}

/**
 * Extrae el body del error de forma segura.
 */
function extractErrorBody(error: unknown): Record<string, unknown> {
    if (!error) return {};
    
    if (typeof error === 'string') {
        return { message: error };
    }
    
    if (typeof error === 'object') {
        return error as Record<string, unknown>;
    }
    
    return { message: String(error) };
}
