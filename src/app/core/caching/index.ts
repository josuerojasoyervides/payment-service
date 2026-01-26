/**
 * Caching module.
 *
 * Provides services and interceptors for HTTP caching:
 * - In-memory cache with LRU eviction
 * - TTL configurable per URL pattern
 * - Automatic invalidation on mutations
 */

export * from './cache.interceptor';
export * from './cache.service';
export * from './cache.types';
