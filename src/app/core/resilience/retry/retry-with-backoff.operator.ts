import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { mergeMap, retryWhen, scan } from 'rxjs/operators';

import {
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
  parseRetryAfterHeader,
  RetryConfig,
  RetryExhaustedError,
} from './retry.types';

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
  /** Callback executed before each retry */
  onRetry?: (attempt: number, delay: number, error: HttpErrorResponse) => void;

  /** Callback executed when retries are exhausted */
  onExhausted?: (attempts: number, lastError: HttpErrorResponse) => void;

  /** HTTP method to validate if retryable (optional) */
  method?: string;
}

/**
 * RxJS operator that implements retry with exponential backoff.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Respects Retry-After header
 * - Configurable per request
 * - Callbacks for observability
 *
 * @param options Retry configuration options
 * @returns Operator that applies retry with backoff
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
  options: RetryWithBackoffOptions = {},
): (source: Observable<T>) => Observable<T> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options,
  };

  return (source: Observable<T>): Observable<T> => {
    return source.pipe(
      retryWhen((errors) =>
        errors.pipe(
          scan<HttpErrorResponse, RetryOperatorState>(
            (state, error) => ({
              attempt: state.attempt + 1,
              errors: [...state.errors, error],
            }),
            { attempt: 0, errors: [] },
          ),
          mergeMap((state) => {
            const { attempt, errors } = state;
            const lastError = errors[errors.length - 1];

            if (!isRetryableHttpError(lastError, config, options.method)) {
              return throwError(() => lastError);
            }

            if (attempt >= config.maxRetries) {
              options.onExhausted?.(attempt, lastError);
              return throwError(
                () => new RetryExhaustedError(lastError.url ?? 'unknown', attempt, lastError),
              );
            }

            const delay = getRetryDelay(attempt, lastError, config);

            options.onRetry?.(attempt, delay, lastError);

            return timer(delay);
          }),
        ),
      ),
    );
  };
}

/**
 * Simplified version of the operator with default configuration.
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
 * Operator that applies retry only for specific errors.
 *
 * @param statusCodes HTTP status codes to retry
 * @param options Additional options
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
  options: Omit<RetryWithBackoffOptions, 'retryableStatusCodes'> = {},
): (source: Observable<T>) => Observable<T> {
  return retryWithBackoff({
    ...options,
    retryableStatusCodes: statusCodes,
  });
}

/**
 * Operator that applies retry only for server errors (5xx).
 *
 * @example
 * ```typescript
 * httpClient.get('/api/data').pipe(retryOnServerError());
 * ```
 */
export function retryOnServerError<T>(
  options: Omit<RetryWithBackoffOptions, 'retryableStatusCodes'> = {},
): (source: Observable<T>) => Observable<T> {
  return retryWithBackoff({
    ...options,
    retryableStatusCodes: [500, 502, 503, 504],
  });
}

/**
 * Operator that applies retry only for rate limiting errors (429).
 *
 * Uses a longer initial delay and respects Retry-After.
 *
 * @example
 * ```typescript
 * httpClient.get('/api/data').pipe(retryOnRateLimit());
 * ```
 */
export function retryOnRateLimit<T>(
  options: Omit<RetryWithBackoffOptions, 'retryableStatusCodes'> = {},
): (source: Observable<T>) => Observable<T> {
  return retryWithBackoff({
    initialDelay: 5000,
    maxRetries: 5,
    ...options,
    retryableStatusCodes: [429],
  });
}

/**
 * Checks if an HTTP error is retryable.
 */
function isRetryableHttpError(
  error: unknown,
  config: RetryConfig,
  method?: string,
): error is HttpErrorResponse {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }

  if (method && !config.retryableMethods.includes(method.toUpperCase())) {
    return false;
  }

  // Verificar status code
  return isRetryableError(error, config);
}

/**
 * Calcula el delay para un retry.
 */
function getRetryDelay(attempt: number, error: HttpErrorResponse, config: RetryConfig): number {
  // Priorizar Retry-After header
  const retryAfter = parseRetryAfterHeader(error);
  if (retryAfter !== undefined) {
    return Math.min(retryAfter, config.maxDelay);
  }

  // Usar backoff exponencial
  return calculateBackoffDelay(attempt, config);
}
