import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, mergeMap, retryWhen, scan } from 'rxjs/operators';
import {
    RetryConfig,
    DEFAULT_RETRY_CONFIG,
    isRetryableError,
    calculateBackoffDelay,
    parseRetryAfterHeader,
    RetryExhaustedError,
} from '../models/retry.types';

/**
 * Estado interno del operador de retry.
 */
interface RetryOperatorState {
    attempt: number;
    errors: HttpErrorResponse[];
}

/**
 * Opciones para el operador retryWithBackoff.
 */
export interface RetryWithBackoffOptions extends Partial<RetryConfig> {
    /** Callback ejecutado antes de cada retry */
    onRetry?: (attempt: number, delay: number, error: HttpErrorResponse) => void;

    /** Callback ejecutado cuando se agotan los reintentos */
    onExhausted?: (attempts: number, lastError: HttpErrorResponse) => void;

    /** Método HTTP para validar si es reintentable (opcional) */
    method?: string;
}

/**
 * Operador RxJS que implementa retry con backoff exponencial.
 * 
 * Características:
 * - Backoff exponencial con jitter
 * - Respeta header Retry-After
 * - Configurable por request
 * - Callbacks para observabilidad
 * 
 * @param options Opciones de configuración del retry
 * @returns Operador que aplica retry con backoff
 * 
 * @example
 * ```typescript
 * httpClient.get('/api/data').pipe(
 *   retryWithBackoff({
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     onRetry: (attempt, delay) => console.log(`Retrying in ${delay}ms`)
 *   })
 * );
 * ```
 */
export function retryWithBackoff<T>(
    options: RetryWithBackoffOptions = {}
): (source: Observable<T>) => Observable<T> {
    const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        ...options,
    };

    return (source: Observable<T>): Observable<T> => {
        return source.pipe(
            retryWhen(errors =>
                errors.pipe(
                    scan<HttpErrorResponse, RetryOperatorState>(
                        (state, error) => ({
                            attempt: state.attempt + 1,
                            errors: [...state.errors, error],
                        }),
                        { attempt: 0, errors: [] }
                    ),
                    mergeMap(state => {
                        const { attempt, errors } = state;
                        const lastError = errors[errors.length - 1];

                        // Verificar si el error es reintentable
                        if (!isRetryableHttpError(lastError, config, options.method)) {
                            return throwError(() => lastError);
                        }

                        // Verificar si quedan intentos
                        if (attempt >= config.maxRetries) {
                            options.onExhausted?.(attempt, lastError);
                            return throwError(() => new RetryExhaustedError(
                                lastError.url ?? 'unknown',
                                attempt,
                                lastError
                            ));
                        }

                        // Calcular delay
                        const delay = getRetryDelay(attempt, lastError, config);

                        // Notificar retry
                        options.onRetry?.(attempt, delay, lastError);

                        // Esperar y reintentar
                        return timer(delay);
                    })
                )
            )
        );
    };
}

/**
 * Versión simplificada del operador con configuración por defecto.
 * 
 * @example
 * ```typescript
 * httpClient.get('/api/data').pipe(retryWithDefaultBackoff());
 * ```
 */
export function retryWithDefaultBackoff<T>(): (source: Observable<T>) => Observable<T> {
    return retryWithBackoff();
}

/**
 * Operador que aplica retry solo para errores específicos.
 * 
 * @param statusCodes Códigos de status HTTP a reintentar
 * @param options Opciones adicionales
 * 
 * @example
 * ```typescript
 * httpClient.get('/api/data').pipe(
 *   retryOnStatus([503, 504], { maxRetries: 5 })
 * );
 * ```
 */
export function retryOnStatus<T>(
    statusCodes: number[],
    options: Omit<RetryWithBackoffOptions, 'retryableStatusCodes'> = {}
): (source: Observable<T>) => Observable<T> {
    return retryWithBackoff({
        ...options,
        retryableStatusCodes: statusCodes,
    });
}

/**
 * Operador que aplica retry solo para errores de servidor (5xx).
 * 
 * @example
 * ```typescript
 * httpClient.get('/api/data').pipe(retryOnServerError());
 * ```
 */
export function retryOnServerError<T>(
    options: Omit<RetryWithBackoffOptions, 'retryableStatusCodes'> = {}
): (source: Observable<T>) => Observable<T> {
    return retryWithBackoff({
        ...options,
        retryableStatusCodes: [500, 502, 503, 504],
    });
}

/**
 * Operador que aplica retry solo para errores de rate limiting (429).
 * 
 * Usa un delay inicial más largo y respeta Retry-After.
 * 
 * @example
 * ```typescript
 * httpClient.get('/api/data').pipe(retryOnRateLimit());
 * ```
 */
export function retryOnRateLimit<T>(
    options: Omit<RetryWithBackoffOptions, 'retryableStatusCodes'> = {}
): (source: Observable<T>) => Observable<T> {
    return retryWithBackoff({
        initialDelay: 5000, // Delay más largo para rate limiting
        maxRetries: 5,
        ...options,
        retryableStatusCodes: [429],
    });
}

// ============================================================
// HELPERS PRIVADOS
// ============================================================

/**
 * Verifica si un error HTTP es reintentable.
 */
function isRetryableHttpError(
    error: unknown,
    config: RetryConfig,
    method?: string
): error is HttpErrorResponse {
    // Verificar que es un HttpErrorResponse
    if (!(error instanceof HttpErrorResponse)) {
        return false;
    }

    // Verificar método si se especificó
    if (method && !config.retryableMethods.includes(method.toUpperCase())) {
        return false;
    }

    // Verificar status code
    return isRetryableError(error, config);
}

/**
 * Calcula el delay para un retry.
 */
function getRetryDelay(
    attempt: number,
    error: HttpErrorResponse,
    config: RetryConfig
): number {
    // Priorizar Retry-After header
    const retryAfter = parseRetryAfterHeader(error);
    if (retryAfter !== undefined) {
        return Math.min(retryAfter, config.maxDelay);
    }

    // Usar backoff exponencial
    return calculateBackoffDelay(attempt, config);
}
