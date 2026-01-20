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
} from '../models/cache.types';
import { LoggerService } from './logger.service';

/**
 * Token para inyectar configuración del Cache.
 */
export const CACHE_CONFIG = new InjectionToken<Partial<CacheConfig>>('CACHE_CONFIG');

/**
 * Token para inyectar patrones de TTL personalizados.
 */
export const CACHE_TTL_PATTERNS = new InjectionToken<TTLPattern[]>('CACHE_TTL_PATTERNS');

/**
 * Servicio de caché en memoria con LRU eviction y TTL.
 * 
 * Características:
 * - LRU (Least Recently Used) eviction
 * - TTL por entrada
 * - Invalidación por key, patrón o tags
 * - Estadísticas de uso
 * - Integración con LoggerService
 * 
 * @example
 * ```typescript
 * // Guardar en caché
 * cacheService.set('key', data, { ttl: 60000 });
 * 
 * // Obtener del caché
 * const result = cacheService.get<MyData>('key');
 * if (result) {
 *   console.log(result.data);
 * }
 * 
 * // Invalidar
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

    /** Cache principal */
    private readonly cache = new Map<string, CacheEntry>();

    /** Índice de tags para invalidación por grupo */
    private readonly tagIndex = new Map<string, Set<string>>();

    /** Estadísticas */
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
     * Obtiene un valor del caché.
     * 
     * @param key Cache key
     * @returns El valor cacheado o undefined si no existe/expiró
     */
    get<T>(key: string): CacheResult<T> | undefined {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Verificar expiración
        if (this.isExpired(entry)) {
            this.delete(key);
            this.stats.misses++;
            return undefined;
        }

        // Actualizar LRU
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
     * Guarda un valor en el caché.
     * 
     * @param key Cache key
     * @param data Datos a cachear
     * @param options Opciones de caché
     */
    set<T>(key: string, data: T, options?: CacheOptions): void {
        // Verificar si necesitamos hacer eviction
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

        // Actualizar índice de tags
        if (options?.tags) {
            for (const tag of options.tags) {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                this.tagIndex.get(tag)!.add(key);
            }
        }

        this.logger.debug(
            `Cache SET`,
            'CacheService',
            { key, ttl: entry.ttl, tags: options?.tags }
        );
    }

    /**
     * Verifica si una key existe y no está expirada.
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
     * Elimina una entrada del caché.
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);

        // Limpiar de índices de tags
        for (const keys of this.tagIndex.values()) {
            keys.delete(key);
        }

        if (deleted) {
            this.logger.debug(`Cache DELETE`, 'CacheService', { key });
        }

        return deleted;
    }

    /**
     * Invalida una entrada específica.
     */
    invalidate(key: string): boolean {
        return this.delete(key);
    }

    /**
     * Invalida todas las entradas que coincidan con un patrón.
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
            this.logger.info(
                `Cache INVALIDATE PATTERN`,
                'CacheService',
                { pattern: pattern.toString(), count }
            );
        }

        return count;
    }

    /**
     * Invalida todas las entradas con un tag específico.
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
            this.logger.info(
                `Cache INVALIDATE TAG`,
                'CacheService',
                { tag, count }
            );
        }

        return count;
    }

    /**
     * Limpia todo el caché.
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
     * Obtiene estadísticas de una entrada específica.
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
     * Limpia entradas expiradas.
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
     * Genera una cache key para una URL y parámetros.
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
     * Obtiene la configuración actual.
     */
    getConfig(): Readonly<CacheConfig> {
        return this.config;
    }

    // ============================================================
    // MÉTODOS PRIVADOS
    // ============================================================

    /**
     * Verifica si una entrada está expirada.
     */
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

            this.logger.debug(
                `Cache LRU EVICTION`,
                'CacheService',
                { evictedKey: oldestKey }
            );
        }
    }
}
