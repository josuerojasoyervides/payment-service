/**
 * Core Module
 * 
 * Central module with cross-cutting application services:
 * - Resilience: Circuit Breaker, Rate Limiter, Retry
 * - Caching: HTTP cache with LRU and TTL
 * - Logging: Structured logging with correlation IDs
 * - Testing: Fake backends for development
 * 
 * @example
 * ```typescript
 * import { CircuitBreakerService, retryInterceptor } from '@core/resilience';
 * import { CacheService, cacheInterceptor } from '@core/caching';
 * import { LoggerService, loggingInterceptor } from '@core/logging';
 * 
 * import { 
 *   CircuitBreakerService,
 *   CacheService,
 *   LoggerService
 * } from '@core';
 * ```
 */

// Resilience
export * from './resilience';

// Caching
export * from './caching';

// Logging
export * from './logging';

// Testing
export * from './testing';

// i18n
export * from './i18n';
