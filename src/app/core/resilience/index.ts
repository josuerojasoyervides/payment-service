/**
 * Módulo de Resiliencia
 *
 * Provee servicios e interceptors para manejo de fallos:
 * - Circuit Breaker: Previene llamadas a servicios que están fallando
 * - Rate Limiter: Controla exceso de requests
 * - Retry: Reintentos automáticos con backoff exponencial
 */

// Circuit Breaker
export * from './circuit-breaker';

// Rate Limiter
export * from './rate-limiter';

// Retry
export * from './retry';

// Resilience Interceptor (combina Circuit Breaker + Rate Limiter)
export * from './resilience.interceptor';
export * from './resilience.types';
