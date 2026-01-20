/**
 * HTTP cache system configuration.
 */
export interface CacheConfig {
    /** Default TTL in milliseconds (default: 30000 = 30s) */
    defaultTTL: number;

    /** Maximum number of cache entries (default: 100) */
    maxEntries: number;

    /** HTTP methods that are cacheable (default: ['GET']) */
    cacheableMethods: string[];

    /** URL patterns to exclude from cache */
    excludePatterns: RegExp[];

    /** Whether to respect Cache-Control headers (default: true) */
    respectCacheControl: boolean;

    /** Whether to add X-Cache header to responses (default: true) */
    addCacheHeader: boolean;
}

/**
 * Individual cache entry.
 */
export interface CacheEntry<T = unknown> {
    /** Cached data */
    data: T;

    /** Timestamp when cached */
    timestamp: number;

    /** Specific TTL for this entry */
    ttl: number;

    /** ETag for conditional validation */
    etag?: string;

    /** Last access (for LRU) */
    lastAccess: number;

    /** Number of accesses (for statistics) */
    accessCount: number;

    /** Original response headers */
    headers?: Record<string, string>;
}

/**
 * Cache information for debugging/observability.
 */
export interface CacheInfo {
    /** Number of active entries */
    size: number;

    /** Maximum number of entries */
    maxSize: number;

    /** Hit ratio (hits / total requests) */
    hitRatio: number;

    /** Total hits */
    hits: number;

    /** Total misses */
    misses: number;

    /** Expired entries removed */
    evictions: number;
}

/**
 * Statistics for a specific entry.
 */
export interface CacheEntryStats {
    /** Cache key */
    key: string;

    /** Creation timestamp */
    createdAt: number;

    /** Last access timestamp */
    lastAccessAt: number;

    /** Number of accesses */
    accessCount: number;

    /** Remaining TTL in ms */
    remainingTTL: number;

    /** Whether entry is expired */
    isExpired: boolean;

    /** Approximate size in bytes */
    sizeBytes: number;
}

/**
 * Options for individual cache operations.
 */
export interface CacheOptions {
    /** Specific TTL for this operation */
    ttl?: number;

    /** Tags for group invalidation */
    tags?: string[];

    /** ETag for conditional validation */
    etag?: string;

    /** Force refresh (ignore existing cache) */
    forceRefresh?: boolean;
}

/**
 * Result of a cache operation.
 */
export interface CacheResult<T> {
    /** Retrieved data */
    data: T;

    /** Whether it was a cache hit */
    hit: boolean;

    /** Key used */
    key: string;

    /** Remaining TTL (if hit) */
    remainingTTL?: number;

    /** Timestamp when cached (if hit) */
    cachedAt?: number;
}

/**
 * TTL configuration by URL pattern.
 */
export interface TTLPattern {
    /** URL pattern (regex) */
    pattern: RegExp;

    /** TTL in ms for this pattern */
    ttl: number;

    /** Pattern description */
    description?: string;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
    defaultTTL: 30000,
    maxEntries: 100,
    cacheableMethods: ['GET'],
    excludePatterns: [
        /\/auth\//,
        /\/login$/,
        /\/logout$/,
        /\/refresh-token$/,
    ],
    respectCacheControl: true,
    addCacheHeader: true,
};

/**
 * Predefined TTL patterns for common endpoints.
 */
export const COMMON_TTL_PATTERNS: TTLPattern[] = [
    {
        pattern: /\/intents\/[^/]+$/,
        ttl: 30000,
        description: 'Payment intent status',
    },
    {
        pattern: /\/config$/,
        ttl: 300000,
        description: 'Configuration endpoints',
    },
    {
        pattern: /\/static\//,
        ttl: 3600000,
        description: 'Static resources',
    },
];

/**
 * Generates a cache key from URL and parameters.
 */
export function generateCacheKey(url: string, params?: Record<string, string>): string {
    let key = url;

    if (params && Object.keys(params).length > 0) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(k => `${k}=${params[k]}`)
            .join('&');
        key = `${url}?${sortedParams}`;
    }

    return key;
}

/**
 * Checks if a URL is excluded from cache.
 */
export function isExcludedFromCache(url: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(url));
}

/**
 * Gets TTL for a URL based on patterns.
 */
export function getTTLForUrl(url: string, patterns: TTLPattern[], defaultTTL: number): number {
    for (const pattern of patterns) {
        if (pattern.pattern.test(url)) {
            return pattern.ttl;
        }
    }
    return defaultTTL;
}

/**
 * Parses Cache-Control header to extract max-age.
 */
export function parseCacheControlMaxAge(cacheControl: string | null): number | undefined {
    if (!cacheControl) {
        return undefined;
    }

    const match = cacheControl.match(/max-age=(\d+)/);
    if (match) {
        return parseInt(match[1], 10) * 1000;
    }

    return undefined;
}

/**
 * Checks if Cache-Control header indicates no-cache or no-store.
 */
export function shouldSkipCache(cacheControl: string | null): boolean {
    if (!cacheControl) {
        return false;
    }

    return cacheControl.includes('no-cache') || cacheControl.includes('no-store');
}

/**
 * Estimates size in bytes of an object.
 */
export function estimateSizeInBytes(obj: unknown): number {
    try {
        const str = JSON.stringify(obj);
        return Math.ceil(str.length * 1.5);
    } catch {
        return 0;
    }
}
