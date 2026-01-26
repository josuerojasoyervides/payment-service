/**
 * Resilience module.
 *
 * Provides services and interceptors for failure handling:
 * - Circuit Breaker: prevents calls to failing services
 * - Rate Limiter: controls request bursts
 * - Retry: automatic retries with exponential backoff
 */

// Circuit Breaker
export * from './circuit-breaker';

// Rate Limiter
export * from './rate-limiter';

// Retry
export * from './retry';

// Resilience Interceptor (combines Circuit Breaker + Rate Limiter)
export * from './resilience.interceptor';
export * from './resilience.types';
