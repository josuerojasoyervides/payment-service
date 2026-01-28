import type { HttpErrorResponse, HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { throwError, timer } from 'rxjs';
import { catchError, mergeMap, tap } from 'rxjs/operators';

import { LoggerService } from '../../logging/logger.service';
import { CircuitBreakerService, CircuitOpenError } from '../circuit-breaker';
import { RetryService } from './retry.service';

/**
 * URL patterns excluded from automatic retries.
 */
const EXCLUDE_PATTERNS = [/\/health$/, /\/metrics$/, /\.json$/];

/**
 * HTTP interceptor that implements automatic retries with exponential backoff.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Respects Retry-After header
 * - Does not retry if Circuit Breaker is open
 * - Detailed logging with correlation IDs
 * - Configurable via RETRY_CONFIG token
 *
 * Recommended interceptor order:
 * 1. retryInterceptor (this)
 * 2. resilienceInterceptor
 * 3. loggingInterceptor
 *
 * @example
 * ```typescript
 * // In app.config.ts
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

  // Check if we should exclude this URL
  if (shouldExclude(endpoint)) {
    return next(req);
  }

  if (!config.retryableMethods.includes(method.toUpperCase())) {
    return next(req);
  }

  const context = {
    attempt: 0,
    startTime: Date.now(),
  };

  const executeRequest = (): Observable<HttpEvent<unknown>> => {
    context.attempt++;
    return next(req);
  };

  const retryRequest = (): Observable<HttpEvent<unknown>> => {
    return executeRequest().pipe(
      tap({
        next: () => {
          if (context.attempt > 1) {
            retryService.recordSuccess(endpoint, method);
          }
        },
      }),
      catchError((error: HttpErrorResponse) => {
        return handleError(
          error,
          context,
          endpoint,
          method,
          retryService,
          circuitBreaker,
          logger,
          config.maxRetries,
          retryRequest,
        );
      }),
    );
  };

  return retryRequest();
};

/**
 * Handles an error and determines if it should retry.
 */
function handleError(
  error: HttpErrorResponse,
  context: { attempt: number; startTime: number },
  endpoint: string,
  method: string,
  retryService: RetryService,
  circuitBreaker: CircuitBreakerService,
  logger: LoggerService,
  maxRetries: number,
  retryFn: () => Observable<HttpEvent<unknown>>,
): Observable<HttpEvent<unknown>> {
  if (isCircuitOpen(circuitBreaker, endpoint)) {
    logger.debug('Circuit is open, not retrying', 'RetryInterceptor', {
      endpoint,
      method,
      attempt: context.attempt,
    });
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

  // Record attempt
  retryService.recordAttempt(endpoint, method, context.attempt, delay, error);

  logger.warn(`Retrying request`, 'RetryInterceptor', {
    endpoint,
    method,
    attempt: context.attempt,
    maxRetries,
    delay,
    status: error.status,
  });

  // Wait and retry
  return timer(delay).pipe(mergeMap(() => retryFn()));
}

/**
 * Check if the URL should be excluded from retry.
 */
function shouldExclude(url: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if the circuit breaker is open for the endpoint.
 */
function isCircuitOpen(circuitBreaker: CircuitBreakerService, endpoint: string): boolean {
  try {
    circuitBreaker.canRequest(endpoint);
    return false;
  } catch (e) {
    return e instanceof CircuitOpenError;
  }
}
