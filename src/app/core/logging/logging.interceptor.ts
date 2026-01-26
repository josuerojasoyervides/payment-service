import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';

import { LoggerService } from './logger.service';
import { HttpLogInfo } from './logging.types';

/**
 * Functional interceptor for HTTP request logging.
 *
 * Features:
 * - Logs all outbound requests with method and URL
 * - Logs responses with status and duration
 * - Logs errors with details
 * - Propagates correlation IDs via headers
 * - Measures response time
 *
 * @example
 * ```typescript
 * // In app.config.ts
 * provideHttpClient(
 *   withInterceptors([loggingInterceptor])
 * )
 * ```
 */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const correlationId = logger.getCorrelationId();
  const startTime = performance.now();

  // Attach correlation ID for end-to-end tracing
  const clonedReq = req.clone({
    setHeaders: {
      'X-Correlation-ID': correlationId,
    },
  });

  // Extract request info (exclude sensitive body by default)
  const logInfo: HttpLogInfo = {
    method: req.method,
    url: sanitizeUrl(req.url),
  };

  // Outbound request log
  logger.debug(
    `HTTP ${req.method} ${sanitizeUrl(req.url)}`,
    'HttpClient',
    { ...logInfo, hasBody: !!req.body },
    correlationId,
  );

  return next(clonedReq).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        const duration = Math.round(performance.now() - startTime);

        logger.info(
          `HTTP ${req.method} ${sanitizeUrl(req.url)} - ${event.status}`,
          'HttpClient',
          {
            ...logInfo,
            status: event.status,
            duration,
            contentLength: getContentLength(event),
          },
          correlationId,
        );
      }
    }),
    catchError((error: HttpErrorResponse) => {
      const duration = Math.round(performance.now() - startTime);

      logger.error(
        `HTTP ${req.method} ${sanitizeUrl(req.url)} - ${error.status} ${error.statusText}`,
        'HttpClient',
        error,
        {
          ...logInfo,
          status: error.status,
          statusText: error.statusText,
          duration,
          errorBody: sanitizeErrorBody(error.error),
        },
        correlationId,
      );

      return throwError(() => error);
    }),
  );
};

/**
 * Sanitize the URL by removing tokens or sensitive data.
 */
function sanitizeUrl(url: string): string {
  // Remove query params that can contain tokens
  const sensitiveParams = ['token', 'key', 'secret', 'password', 'apiKey', 'api_key'];

  try {
    const urlObj = new URL(url, window.location.origin);

    for (const param of sensitiveParams) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    }

    return urlObj.pathname + urlObj.search;
  } catch {
    return url;
  }
}

/**
 * Gets response content-length if available.
 */
function getContentLength(response: HttpResponse<unknown>): number | undefined {
  const contentLength = response.headers.get('content-length');
  return contentLength ? parseInt(contentLength, 10) : undefined;
}

/**
 * Sanitize error body for safe logging.
 */
function sanitizeErrorBody(errorBody: unknown): unknown {
  if (!errorBody) return undefined;

  if (typeof errorBody === 'string') {
    // Truncate long strings
    return errorBody.length > 500 ? errorBody.substring(0, 500) + '...' : errorBody;
  }

  if (typeof errorBody === 'object') {
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];

    for (const [key, value] of Object.entries(errorBody as Record<string, unknown>)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  return errorBody;
}
