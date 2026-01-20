import {
    HttpInterceptorFn,
    HttpResponse,
    HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { LoggerService } from '../logging/logger.service';
import {
    generateCacheKey,
    parseCacheControlMaxAge,
    shouldSkipCache,
} from './cache.types';

/**
 * Interceptor HTTP que implementa caching de respuestas.
 * 
 * Características:
 * - Cachea solo métodos GET por defecto
 * - Respeta headers Cache-Control
 * - Agrega header X-Cache: HIT o MISS
 * - TTL configurable por URL pattern
 * - Invalidación automática en mutaciones
 * 
 * Orden recomendado de interceptors:
 * 1. cacheInterceptor (este) - PRIMERO para evitar requests innecesarios
 * 2. retryInterceptor
 * 3. resilienceInterceptor
 * 4. loggingInterceptor
 * 
 * @example
 * ```typescript
 * // En app.config.ts
 * provideHttpClient(
 *   withInterceptors([
 *     cacheInterceptor,
 *     retryInterceptor,
 *     resilienceInterceptor,
 *     loggingInterceptor,
 *   ])
 * )
 * ```
 */
export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
    const cacheService = inject(CacheService);
    const logger = inject(LoggerService);
    const config = cacheService.getConfig();

    if (!config.cacheableMethods.includes(req.method.toUpperCase())) {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
            invalidateRelatedCache(req, cacheService, logger);
        }
        return next(req);
    }

    if (cacheService.shouldExclude(req.url)) {
        return next(req);
    }

    const cacheControl = req.headers.get('Cache-Control');
    if (config.respectCacheControl && shouldSkipCache(cacheControl)) {
        logger.debug('Skipping cache due to Cache-Control header', 'CacheInterceptor', {
            url: req.url,
            cacheControl,
        });
        return next(req);
    }

    const cacheKey = generateCacheKey(req.url, getRequestParams(req));

    const cached = cacheService.get<HttpResponse<unknown>>(cacheKey);

    if (cached) {
        logger.debug('Cache HIT', 'CacheInterceptor', {
            url: req.url,
            key: cacheKey,
            remainingTTL: cached.remainingTTL,
        });

        const cachedResponse = addCacheHeader(cached.data, 'HIT');
        return of(cachedResponse);
    }

    logger.debug('Cache MISS', 'CacheInterceptor', { url: req.url, key: cacheKey });

    return next(req).pipe(
        tap(event => {
            if (event instanceof HttpResponse) {
                const responseCacheControl = event.headers.get('Cache-Control');
                if (config.respectCacheControl && shouldSkipCache(responseCacheControl)) {
                    return;
                }

                let ttl: number | undefined;
                if (config.respectCacheControl && responseCacheControl) {
                    ttl = parseCacheControlMaxAge(responseCacheControl);
                }

                cacheService.set(cacheKey, event, { ttl });

                logger.debug('Cache SET', 'CacheInterceptor', {
                    url: req.url,
                    key: cacheKey,
                    ttl: ttl ?? config.defaultTTL,
                });
            }
        }),
        map(event => {
            if (event instanceof HttpResponse && config.addCacheHeader) {
                return addCacheHeader(event, 'MISS');
            }
            return event;
        })
    );
};

/**
 * Adds X-Cache header to a response.
 */
function addCacheHeader<T>(response: HttpResponse<T>, status: 'HIT' | 'MISS'): HttpResponse<T> {
    return response.clone({
        headers: response.headers.set('X-Cache', status),
    });
}

/**
 * Extracts request parameters as an object.
 */
function getRequestParams(req: HttpRequest<unknown>): Record<string, string> | undefined {
    const params: Record<string, string> = {};
    const keys = req.params.keys();

    if (keys.length === 0) {
        return undefined;
    }

    for (const key of keys) {
        const value = req.params.get(key);
        if (value !== null) {
            params[key] = value;
        }
    }

    return params;
}

/**
 * Invalidates related cache for mutation operations.
 * 
 * Invalidation strategy:
 * - POST /intents → Doesn't invalidate (creates new)
 * - POST /intents/:id/confirm → Invalidates /intents/:id
 * - POST /intents/:id/cancel → Invalidates /intents/:id
 * - PUT /resource/:id → Invalidates /resource/:id
 * - DELETE /resource/:id → Invalidates /resource/:id
 */
function invalidateRelatedCache(
    req: HttpRequest<unknown>,
    cacheService: CacheService,
    logger: LoggerService
): void {
    const url = req.url;

    const confirmCancelMatch = url.match(/\/intents\/([^/]+)\/(confirm|cancel)$/);
    if (confirmCancelMatch) {
        const intentId = confirmCancelMatch[1];

        const invalidated = cacheService.invalidatePattern(new RegExp(`/intents/${intentId}`));
        if (invalidated > 0) {
            logger.info('Cache invalidated for intent mutation', 'CacheInterceptor', {
                intentId,
                action: confirmCancelMatch[2],
                entriesInvalidated: invalidated,
            });
        }
        return;
    }

    if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const resourceMatch = url.match(/^(.+\/[^/]+)$/);
        if (resourceMatch) {
            const resourceUrl = resourceMatch[1];
            const invalidated = cacheService.invalidate(resourceUrl);
            if (invalidated) {
                logger.debug('Cache invalidated for resource mutation', 'CacheInterceptor', {
                    url: resourceUrl,
                    method: req.method,
                });
            }
        }
    }
}

/**
 * Factory function to create interceptor with custom options.
 */
export function createCacheInterceptor(options?: {
    /** Force caching even if Cache-Control says no-cache */
    ignoreNoCache?: boolean;
    /** Additional tags for all entries */
    defaultTags?: string[];
}): HttpInterceptorFn {
    return (req, next) => {
        const cacheService = inject(CacheService);
        const logger = inject(LoggerService);
        const config = cacheService.getConfig();

        if (!config.cacheableMethods.includes(req.method.toUpperCase())) {
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
                invalidateRelatedCache(req, cacheService, logger);
            }
            return next(req);
        }

        if (cacheService.shouldExclude(req.url)) {
            return next(req);
        }

        if (!options?.ignoreNoCache) {
            const cacheControl = req.headers.get('Cache-Control');
            if (config.respectCacheControl && shouldSkipCache(cacheControl)) {
                return next(req);
            }
        }

        const cacheKey = generateCacheKey(req.url, getRequestParams(req));
        const cached = cacheService.get<HttpResponse<unknown>>(cacheKey);

        if (cached) {
            const cachedResponse = addCacheHeader(cached.data, 'HIT');
            return of(cachedResponse);
        }

        return next(req).pipe(
            tap(event => {
                if (event instanceof HttpResponse) {
                    const responseCacheControl = event.headers.get('Cache-Control');
                    if (!options?.ignoreNoCache && config.respectCacheControl && shouldSkipCache(responseCacheControl)) {
                        return;
                    }

                    let ttl: number | undefined;
                    if (config.respectCacheControl && responseCacheControl) {
                        ttl = parseCacheControlMaxAge(responseCacheControl);
                    }

                    cacheService.set(cacheKey, event, {
                        ttl,
                        tags: options?.defaultTags,
                    });
                }
            }),
            map(event => {
                if (event instanceof HttpResponse && config.addCacheHeader) {
                    return addCacheHeader(event, 'MISS');
                }
                return event;
            })
        );
    };
}
