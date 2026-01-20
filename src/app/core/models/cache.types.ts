/**
 * Configuración del sistema de caché HTTP.
 */
export interface CacheConfig {
    /** TTL por defecto en milisegundos (default: 30000 = 30s) */
    defaultTTL: number;

    /** Número máximo de entradas en caché (default: 100) */
    maxEntries: number;

    /** Métodos HTTP que son cacheables (default: ['GET']) */
    cacheableMethods: string[];

    /** Patrones de URL a excluir del caché */
    excludePatterns: RegExp[];

    /** Si respetar headers Cache-Control (default: true) */
    respectCacheControl: boolean;

    /** Si agregar header X-Cache a las respuestas (default: true) */
    addCacheHeader: boolean;
}

/**
 * Entrada individual en el caché.
 */
export interface CacheEntry<T = unknown> {
    /** Datos cacheados */
    data: T;

    /** Timestamp de cuando se cacheó */
    timestamp: number;

    /** TTL específico para esta entrada */
    ttl: number;

    /** ETag para validación condicional */
    etag?: string;

    /** Último acceso (para LRU) */
    lastAccess: number;

    /** Número de accesos (para estadísticas) */
    accessCount: number;

    /** Headers originales de la respuesta */
    headers?: Record<string, string>;
}

/**
 * Información del caché para debugging/observabilidad.
 */
export interface CacheInfo {
    /** Número de entradas activas */
    size: number;

    /** Número máximo de entradas */
    maxSize: number;

    /** Ratio de aciertos (hits / total requests) */
    hitRatio: number;

    /** Total de aciertos */
    hits: number;

    /** Total de fallos */
    misses: number;

    /** Entradas expiradas eliminadas */
    evictions: number;
}

/**
 * Estadísticas de una entrada específica.
 */
export interface CacheEntryStats {
    /** Key del caché */
    key: string;

    /** Timestamp de creación */
    createdAt: number;

    /** Timestamp de último acceso */
    lastAccessAt: number;

    /** Número de accesos */
    accessCount: number;

    /** TTL restante en ms */
    remainingTTL: number;

    /** Si la entrada está expirada */
    isExpired: boolean;

    /** Tamaño aproximado en bytes */
    sizeBytes: number;
}

/**
 * Opciones para operaciones de caché individuales.
 */
export interface CacheOptions {
    /** TTL específico para esta operación */
    ttl?: number;

    /** Tags para invalidación por grupo */
    tags?: string[];

    /** ETag para validación condicional */
    etag?: string;

    /** Forzar refresco (ignorar caché existente) */
    forceRefresh?: boolean;
}

/**
 * Resultado de una operación de caché.
 */
export interface CacheResult<T> {
    /** Datos obtenidos */
    data: T;

    /** Si fue un acierto de caché */
    hit: boolean;

    /** Key usada */
    key: string;

    /** TTL restante (si fue hit) */
    remainingTTL?: number;

    /** Timestamp de cuando se cacheó (si fue hit) */
    cachedAt?: number;
}

/**
 * Configuración de TTL por patrón de URL.
 */
export interface TTLPattern {
    /** Patrón de URL (regex) */
    pattern: RegExp;

    /** TTL en ms para este patrón */
    ttl: number;

    /** Descripción del patrón */
    description?: string;
}

/**
 * Configuración por defecto del caché.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
    defaultTTL: 30000,         // 30 segundos
    maxEntries: 100,
    cacheableMethods: ['GET'],
    excludePatterns: [
        /\/auth\//,            // Endpoints de autenticación
        /\/login$/,
        /\/logout$/,
        /\/refresh-token$/,
    ],
    respectCacheControl: true,
    addCacheHeader: true,
};

/**
 * Patrones de TTL predefinidos para endpoints comunes.
 */
export const COMMON_TTL_PATTERNS: TTLPattern[] = [
    {
        pattern: /\/intents\/[^/]+$/,
        ttl: 30000,  // 30s para estados de pago
        description: 'Payment intent status',
    },
    {
        pattern: /\/config$/,
        ttl: 300000, // 5 minutos para configuración
        description: 'Configuration endpoints',
    },
    {
        pattern: /\/static\//,
        ttl: 3600000, // 1 hora para recursos estáticos
        description: 'Static resources',
    },
];

/**
 * Genera una cache key a partir de URL y parámetros.
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
 * Verifica si una URL está excluida del caché.
 */
export function isExcludedFromCache(url: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(url));
}

/**
 * Obtiene el TTL para una URL basado en patrones.
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
 * Parsea el header Cache-Control para extraer max-age.
 */
export function parseCacheControlMaxAge(cacheControl: string | null): number | undefined {
    if (!cacheControl) {
        return undefined;
    }

    const match = cacheControl.match(/max-age=(\d+)/);
    if (match) {
        return parseInt(match[1], 10) * 1000; // Convertir a ms
    }

    return undefined;
}

/**
 * Verifica si el header Cache-Control indica no-cache o no-store.
 */
export function shouldSkipCache(cacheControl: string | null): boolean {
    if (!cacheControl) {
        return false;
    }

    return cacheControl.includes('no-cache') || cacheControl.includes('no-store');
}

/**
 * Estima el tamaño en bytes de un objeto.
 */
export function estimateSizeInBytes(obj: unknown): number {
    try {
        const str = JSON.stringify(obj);
        // En UTF-8, cada carácter puede ser 1-4 bytes, asumimos promedio de 1.5
        return Math.ceil(str.length * 1.5);
    } catch {
        return 0;
    }
}
