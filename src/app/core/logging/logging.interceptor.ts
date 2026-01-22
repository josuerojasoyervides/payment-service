import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, catchError, throwError } from 'rxjs';
import { LoggerService } from './logger.service';
import { HttpLogInfo } from './logging.types';

/**
 * Interceptor funcional para logging de requests HTTP.
 *
 * Características:
 * - Loguea todos los requests salientes con método y URL
 * - Loguea respuestas con status y duración
 * - Loguea errores con detalles
 * - Propaga correlation ID en headers
 * - Mide tiempos de respuesta
 *
 * @example
 * ```typescript
 * // En app.config.ts
 * provideHttpClient(
 *   withInterceptors([loggingInterceptor])
 * )
 * ```
 */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const correlationId = logger.getCorrelationId();
  const startTime = performance.now();

  // Agregar correlation ID al header para tracing end-to-end
  const clonedReq = req.clone({
    setHeaders: {
      'X-Correlation-ID': correlationId,
    },
  });

  // Extraer info del request (sin body sensible por defecto)
  const logInfo: HttpLogInfo = {
    method: req.method,
    url: sanitizeUrl(req.url),
  };

  // Log del request saliente
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
 * Sanitiza la URL removiendo tokens o datos sensibles.
 */
function sanitizeUrl(url: string): string {
  // Remover query params que puedan contener tokens
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
 * Sanitiza el body del error para logging seguro.
 */
function sanitizeErrorBody(errorBody: unknown): unknown {
  if (!errorBody) return undefined;

  if (typeof errorBody === 'string') {
    // Truncar strings muy largos
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
