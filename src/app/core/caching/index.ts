/**
 * Módulo de Caching
 *
 * Provee servicios e interceptors para caching HTTP:
 * - Cache en memoria con LRU eviction
 * - TTL configurable por patrón de URL
 * - Invalidación automática en mutaciones
 */

export * from './cache.interceptor';
export * from './cache.service';
export * from './cache.types';
