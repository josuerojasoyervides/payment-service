import { HttpInterceptorFn, HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, timer, defer } from 'rxjs';
import { catchError, mergeMap, tap } from 'rxjs/operators';
import { RetryService } from '../services/retry.service';
import { LoggerService } from '../services/logger.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { CircuitOpenError } from '../models';

/**
 * Patrones de URL a excluir del retry automático.
 */
const EXCLUDE_PATTERNS = [
    /\/health$/,
    /\/metrics$/,
    /\.json$/,
];

/**
 * Interceptor HTTP que implementa retry automático con backoff exponencial.
 * 
 * Características:
 * - Backoff exponencial con jitter
 * - Respeta header Retry-After
 * - No reintenta si el Circuit Breaker está abierto
 * - Logging detallado con correlation IDs
 * - Configurable vía RETRY_CONFIG token
 * 
 * Orden recomendado de interceptors:
 * 1. retryInterceptor (este)
 * 2. resilienceInterceptor
 * 3. loggingInterceptor
 * 
 * @example
 * ```typescript
 * // En app.config.ts
 * provideHttpClient(
 *   withInterceptors([
 *     retryInterceptor,
 *     resilienceInterceptor,
 *     loggingInterceptor,
 *   ])
 * )
 * ```
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
    const retryService = inject(RetryService);
    const logger = inject(LoggerService);
    const circuitBreaker = inject(CircuitBreakerService);

    const endpoint = req.url;
    const method = req.method;
    const config = retryService.getConfig();

    // Verificar si debemos excluir esta URL
    if (shouldExclude(endpoint)) {
        return next(req);
    }

    // Verificar si el método es reintentable
    if (!config.retryableMethods.includes(method.toUpperCase())) {
        return next(req);
    }

    // Contexto del retry
    const context = {
        attempt: 0,
        startTime: Date.now(),
    };

    // Función que ejecuta el request
    const executeRequest = (): Observable<HttpEvent<unknown>> => {
        context.attempt++;
        return next(req);
    };

    // Función recursiva de retry
    const retryRequest = (): Observable<HttpEvent<unknown>> => {
        return executeRequest().pipe(
            tap({
                next: () => {
                    // Request exitoso
                    if (context.attempt > 1) {
                        retryService.recordSuccess(endpoint, method);
                    }
                },
            }),
            catchError((error: HttpErrorResponse) => {
                return handleError(
                    error,
                    req,
                    context,
                    retryService,
                    circuitBreaker,
                    logger,
                    config.maxRetries,
                    retryRequest
                );
            })
        );
    };

    return retryRequest();
};

/**
 * Maneja un error y determina si debe reintentar.
 */
function handleError(
    error: HttpErrorResponse,
    req: HttpRequest<unknown>,
    context: { attempt: number; startTime: number },
    retryService: RetryService,
    circuitBreaker: CircuitBreakerService,
    logger: LoggerService,
    maxRetries: number,
    retryFn: () => Observable<HttpEvent<unknown>>
): Observable<HttpEvent<unknown>> {
    const endpoint = req.url;
    const method = req.method;

    // Verificar si el circuit breaker está abierto
    if (isCircuitOpen(circuitBreaker, endpoint)) {
        logger.debug(
            'Circuit is open, not retrying',
            'RetryInterceptor',
            { endpoint, method, attempt: context.attempt }
        );
        return throwError(() => error);
    }

    // Verificar si debemos reintentar
    if (!retryService.shouldRetry(error, method, context.attempt)) {
        if (context.attempt > 1) {
            retryService.recordFailure(endpoint, method);
        }
        return throwError(() => error);
    }

    // Calcular delay
    const delay = retryService.getDelay(context.attempt, error);

    // Registrar intento
    retryService.recordAttempt(endpoint, method, context.attempt, delay, error);

    logger.warn(
        `Retrying request`,
        'RetryInterceptor',
        {
            endpoint,
            method,
            attempt: context.attempt,
            maxRetries,
            delay,
            status: error.status,
        }
    );

    // Esperar y reintentar
    return timer(delay).pipe(
        mergeMap(() => retryFn())
    );
}

/**
 * Verifica si la URL debe excluirse del retry.
 */
function shouldExclude(url: string): boolean {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Verifica si el circuit breaker está abierto para el endpoint.
 */
function isCircuitOpen(circuitBreaker: CircuitBreakerService, endpoint: string): boolean {
    try {
        circuitBreaker.canRequest(endpoint);
        return false;
    } catch (e) {
        return e instanceof CircuitOpenError;
    }
}
