import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  CacheConfig,
  CacheEntry,
  CacheInfo,
  CacheEntryStats,
  CacheOptions,
  CacheResult,
  TTLPattern,
  DEFAULT_CACHE_CONFIG,
  COMMON_TTL_PATTERNS,
  generateCacheKey,
  isExcludedFromCache,
  getTTLForUrl,
  estimateSizeInBytes,
} from './cache.types';
import { LoggerService } from '../logging/logger.service';

/**
 * Token to inject Cache configuration.
 */
export const CACHE_CONFIG = new InjectionToken<Partial<CacheConfig>>('CACHE_CONFIG');

/**
 * Token to inject custom TTL patterns.
 */
export const CACHE_TTL_PATTERNS = new InjectionToken<TTLPattern[]>('CACHE_TTL_PATTERNS');

/**
 * In-memory cache service with LRU eviction and TTL.
 *
 * Features:
 * - LRU (Least Recently Used) eviction
 * - TTL per entry
 * - Invalidation by key, pattern or tags
 * - Usage statistics
 * - LoggerService integration
 *
 * @example
 * ```typescript
 * cacheService.set('key', data, { ttl: 60000 });
 *
 * const result = cacheService.get<MyData>('key');
 * if (result) {
 *   console.log(result.data);
 * }
 *
 * cacheService.invalidate('key');
 * cacheService.invalidatePattern(/\/api\/users/);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CacheService {
  private readonly injectedConfig = inject(CACHE_CONFIG, { optional: true });
  private readonly injectedPatterns = inject(CACHE_TTL_PATTERNS, { optional: true });
  private readonly config: CacheConfig;
  private readonly ttlPatterns: TTLPattern[];
  private readonly logger = inject(LoggerService);

  private readonly cache = new Map<string, CacheEntry>();

  private readonly tagIndex = new Map<string, Set<string>>();

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor() {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...this.injectedConfig };
    this.ttlPatterns = this.injectedPatterns ?? COMMON_TTL_PATTERNS;
  }

  /**
   * Gets a value from cache.
   *
   * @param key Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get<T>(key: string): CacheResult<T> | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      return undefined;
    }

    entry.lastAccess = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    return {
      data: entry.data,
      hit: true,
      key,
      remainingTTL: this.getRemainingTTL(entry),
      cachedAt: entry.timestamp,
    };
  }

  /**
   * Saves a value to cache.
   *
   * @param key Cache key
   * @param data Data to cache
   * @param options Cache options
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: options?.ttl ?? this.getTTLForKey(key),
      etag: options?.etag,
      lastAccess: now,
      accessCount: 0,
    };

    this.cache.set(key, entry);

    if (options?.tags) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }

    this.logger.debug(`Cache SET`, 'CacheService', { key, ttl: entry.ttl, tags: options?.tags });
  }

  /**
   * Checks if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Deletes an entry from cache.
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);

    for (const keys of this.tagIndex.values()) {
      keys.delete(key);
    }

    if (deleted) {
      this.logger.debug(`Cache DELETE`, 'CacheService', { key });
    }

    return deleted;
  }

  /**
   * Invalidates a specific entry.
   */
  invalidate(key: string): boolean {
    return this.delete(key);
  }

  /**
   * Invalidates all entries matching a pattern.
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.logger.info(`Cache INVALIDATE PATTERN`, 'CacheService', {
        pattern: pattern.toString(),
        count,
      });
    }

    return count;
  }

  /**
   * Invalidates all entries with a specific tag.
   */
  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) {
      return 0;
    }

    let count = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        count++;
      }
    }

    this.tagIndex.delete(tag);

    if (count > 0) {
      this.logger.info(`Cache INVALIDATE TAG`, 'CacheService', { tag, count });
    }

    return count;
  }

  /**
   * Clears entire cache.
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.tagIndex.clear();

    this.logger.info(`Cache CLEAR`, 'CacheService', { entriesCleared: size });
  }

  /**
   * Obtiene información del estado del caché.
   */
  getInfo(): CacheInfo {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      hitRatio: total > 0 ? this.stats.hits / total : 0,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Gets statistics for a specific entry.
   */
  getEntryStats(key: string): CacheEntryStats | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    return {
      key,
      createdAt: entry.timestamp,
      lastAccessAt: entry.lastAccess,
      accessCount: entry.accessCount,
      remainingTTL: this.getRemainingTTL(entry),
      isExpired: this.isExpired(entry),
      sizeBytes: estimateSizeInBytes(entry.data),
    };
  }

  /**
   * Obtiene todas las keys del caché.
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Cleans up expired entries.
   */
  cleanup(): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        count++;
      }
    }

    if (count > 0) {
      this.logger.debug(`Cache CLEANUP`, 'CacheService', { entriesRemoved: count });
    }

    return count;
  }

  /**
   * Resetea las estadísticas.
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Generates a cache key for a URL and parameters.
   */
  generateKey(url: string, params?: Record<string, string>): string {
    return generateCacheKey(url, params);
  }

  /**
   * Verifica si una URL debe ser excluida del caché.
   */
  shouldExclude(url: string): boolean {
    return isExcludedFromCache(url, this.config.excludePatterns);
  }

  /**
   * Gets current configuration.
   */
  getConfig(): Readonly<CacheConfig> {
    return this.config;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Calcula el TTL restante de una entrada.
   */
  private getRemainingTTL(entry: CacheEntry): number {
    const remaining = entry.ttl - (Date.now() - entry.timestamp);
    return Math.max(0, remaining);
  }

  /**
   * Obtiene el TTL para una key basándose en patrones.
   */
  private getTTLForKey(key: string): number {
    return getTTLForUrl(key, this.ttlPatterns, this.config.defaultTTL);
  }

  /**
   * Ejecuta eviction LRU (elimina la entrada menos recientemente usada).
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Primero eliminar expiradas
      if (this.isExpired(entry)) {
        this.delete(key);
        this.stats.evictions++;
        return;
      }

      // Buscar la menos recientemente usada
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;

      this.logger.debug(`Cache LRU EVICTION`, 'CacheService', { evictedKey: oldestKey });
    }
  }
}
