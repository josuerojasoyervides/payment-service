import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import { CircuitBreakerService, CircuitOpenError } from '@core/resilience/circuit-breaker';
import { RateLimiterService, RateLimitExceededError } from '@core/resilience/rate-limiter';
import { DEFAULT_RESILIENCE_CONFIG } from '@core/resilience/resilience.types';
import { catchError, tap, throwError } from 'rxjs';

/**
 * URL patterns excluded from circuit breaker and rate limiting.
 */
const EXCLUDE_PATTERNS = DEFAULT_RESILIENCE_CONFIG.excludePatterns;

/**
 * Resilience interceptor combining Circuit Breaker and Rate Limiting.
 *
 * Features:
 * - Circuit Breaker: prevents calls to failing services
 * - Rate Limiting: prevents request floods
 * - Integrated logging for debugging
 *
 * Check order:
 * 1. Rate Limiting (if enabled)
 * 2. Circuit Breaker (if enabled)
 * 3. Original request
 * 4. Result logging (success/failure)
 *
 * @example
 * ```typescript
 * // In app.config.ts
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

  // Check if we should exclude this URL
  if (shouldExclude(endpoint)) {
    return next(req);
  }

  // 1. Check rate limiting
  try {
    if (!rateLimiter.canRequest(endpoint)) {
      const retryAfter = rateLimiter.getRetryAfter(endpoint);
      const error = new RateLimitExceededError(endpoint, retryAfter);

      logger.warn(`Rate limit exceeded, rejecting request`, 'ResilienceInterceptor', {
        endpoint,
        retryAfter,
      });

      return throwError(
        () =>
          new HttpErrorResponse({
            error,
            status: 429,
            statusText: 'Too Many Requests',
            url: endpoint,
            headers: req.headers,
          }),
      );
    }

    // Record request for rate limiting
    rateLimiter.recordRequest(endpoint);
  } catch (e) {
    if (e instanceof RateLimitExceededError) {
      return throwError(
        () =>
          new HttpErrorResponse({
            error: e,
            status: 429,
            statusText: 'Too Many Requests',
            url: endpoint,
            headers: req.headers,
          }),
      );
    }
    // Other error, continue
  }

  // 2. Verificar Circuit Breaker
  try {
    circuitBreaker.canRequest(endpoint);
  } catch (e) {
    if (e instanceof CircuitOpenError) {
      logger.warn(`Circuit is open, rejecting request`, 'ResilienceInterceptor', {
        endpoint,
        circuitState: e.circuitInfo.state,
        failures: e.circuitInfo.failures,
      });

      return throwError(
        () =>
          new HttpErrorResponse({
            error: e,
            status: 503,
            statusText: 'Service Unavailable (Circuit Open)',
            url: endpoint,
            headers: req.headers,
          }),
      );
    }
    // Other error, continue
  }

  // 3. Ejecutar request y registrar resultado
  return next(req).pipe(
    tap({
      next: () => {
        circuitBreaker.recordSuccess(endpoint);
      },
    }),
    catchError((error: HttpErrorResponse) => {
      circuitBreaker.recordFailure(endpoint, error.status);

      const enrichedError = enrichError(error, circuitBreaker, rateLimiter, endpoint);

      return throwError(() => enrichedError);
    }),
  );
};

/**
 * Check if the URL should be excluded from processing.
 */
function shouldExclude(url: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Enrich HTTP error with resilience information.
 */
function enrichError(
  error: HttpErrorResponse,
  circuitBreaker: CircuitBreakerService,
  rateLimiter: RateLimiterService,
  endpoint: string,
): HttpErrorResponse {
  const circuitInfo = circuitBreaker.getCircuitInfo(endpoint);
  const limitInfo = rateLimiter.getLimitInfo(endpoint);

  // Create new error with additional metadata
  const enrichedError = new HttpErrorResponse({
    error: {
      ...extractErrorBody(error.error),
      _resilience: {
        circuit: circuitInfo
          ? {
              state: circuitInfo.state,
              failures: circuitInfo.failures,
            }
          : undefined,
        rateLimit: limitInfo
          ? {
              remaining: rateLimiter.getRemainingRequests(endpoint),
              retryAfter: rateLimiter.getRetryAfter(endpoint),
            }
          : undefined,
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
 * Extract error body safely.
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
