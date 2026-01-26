/**
 * Core Module
 *
 * Central module with cross-cutting application services:
 * - Resilience: Circuit Breaker, Rate Limiter, Retry
 * - Caching: HTTP cache with LRU and TTL
 * - Logging: Structured logging with correlation IDs
 *
 * @example
 * ```typescript
 * import { CircuitBreakerService, retryInterceptor } from '@core/resilience';
 * import { CacheService, cacheInterceptor } from '@core/caching';
 * import { LoggerService, loggingInterceptor } from '@core/logging';
 * import { I18nKeys, I18nService } from '@core/i18n';
 *
 * import {
 *   CircuitBreakerService,
 *   CacheService,
 *   LoggerService
 * } from '@core';
 * ```
 */

// Resilience (public)
export { CircuitBreakerService } from './resilience/circuit-breaker/circuit-breaker.service';
export { RateLimiterService } from './resilience/rate-limiter/rate-limiter.service';
export { RetryService } from './resilience/retry/retry.service';

// Caching (public)
export { CacheService } from './caching/cache.service';

// Logging (public)
export { LoggerService } from './logging/logger.service';

// i18n (public)
export { I18nKeys } from './i18n/i18n.keys';
export { I18nService } from './i18n/i18n.service';
