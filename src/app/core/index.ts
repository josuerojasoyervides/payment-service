/**
 * Core Module
 * 
 * Módulo central con servicios transversales de la aplicación:
 * - Resilience: Circuit Breaker, Rate Limiter, Retry
 * - Caching: Cache HTTP con LRU y TTL
 * - Logging: Logging estructurado con correlation IDs
 * - Testing: Fake backends para desarrollo
 * 
 * @example
 * ```typescript
 * // Importar módulos específicos
 * import { CircuitBreakerService, retryInterceptor } from '@core/resilience';
 * import { CacheService, cacheInterceptor } from '@core/caching';
 * import { LoggerService, loggingInterceptor } from '@core/logging';
 * 
 * // O importar del barrel principal
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
