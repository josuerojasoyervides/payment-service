import { HttpErrorResponse } from '@angular/common/http';

/**
 * Configuración del sistema de retry con backoff exponencial.
 */
export interface RetryConfig {
    /** Número máximo de reintentos (default: 3) */
    maxRetries: number;

    /** Delay inicial en ms antes del primer reintento (default: 1000) */
    initialDelay: number;

    /** Delay máximo en ms entre reintentos (default: 30000) */
    maxDelay: number;

    /** Multiplicador para el backoff exponencial (default: 2) */
    backoffMultiplier: number;

    /** Códigos de status HTTP que son reintentables (default: [408, 429, 500, 502, 503, 504]) */
    retryableStatusCodes: number[];

    /** Métodos HTTP que son reintentables (default: ['GET', 'PUT', 'DELETE']) */
    retryableMethods: string[];

    /** Factor de jitter para evitar thundering herd (0-1, default: 0.3) */
    jitterFactor: number;
}

/**
 * Información de un intento de retry.
 */
export interface RetryAttemptInfo {
    /** Número del intento actual (1-based) */
    attempt: number;

    /** Número máximo de intentos */
    maxAttempts: number;

    /** Delay calculado para este intento en ms */
    delay: number;

    /** Error que causó el retry */
    error: HttpErrorResponse;

    /** Timestamp del intento */
    timestamp: number;
}

/**
 * Estado del retry para un request específico.
 */
export interface RetryState {
    /** URL del request */
    url: string;

    /** Método HTTP */
    method: string;

    /** Intentos realizados */
    attempts: RetryAttemptInfo[];

    /** Si el request finalmente tuvo éxito */
    succeeded: boolean;

    /** Timestamp de inicio */
    startedAt: number;

    /** Timestamp de fin */
    endedAt?: number;
}

/**
 * Error lanzado cuando se agotan los reintentos.
 */
export class RetryExhaustedError extends Error {
    constructor(
        public readonly url: string,
        public readonly attempts: number,
        public readonly lastError: HttpErrorResponse
    ) {
        super(
            `Retry exhausted after ${attempts} attempts for ${url}. ` +
            `Last error: ${lastError.status} ${lastError.statusText}`
        );
        this.name = 'RetryExhaustedError';
    }
}

/**
 * Configuración por defecto del retry.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableMethods: ['GET', 'PUT', 'DELETE'],
    jitterFactor: 0.3,
};

/**
 * Verifica si un error HTTP es reintentable según la configuración.
 */
export function isRetryableError(error: HttpErrorResponse, config: RetryConfig): boolean {
    return config.retryableStatusCodes.includes(error.status);
}

/**
 * Verifica si un método HTTP es reintentable según la configuración.
 */
export function isRetryableMethod(method: string, config: RetryConfig): boolean {
    return config.retryableMethods.includes(method.toUpperCase());
}

/**
 * Calcula el delay con backoff exponencial y jitter.
 * 
 * @param attempt Número del intento (1-based)
 * @param config Configuración de retry
 * @returns Delay en milisegundos
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    // Backoff exponencial: initialDelay * (multiplier ^ (attempt - 1))
    const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Aplicar límite máximo
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    // Aplicar jitter para evitar thundering herd
    // Jitter range: [delay * (1 - jitter), delay * (1 + jitter)]
    const jitter = config.jitterFactor * cappedDelay;
    const minDelay = cappedDelay - jitter;
    const maxDelay = cappedDelay + jitter;

    return Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
}

/**
 * Extrae el valor de Retry-After header si existe.
 * 
 * @param error Error HTTP con posible header Retry-After
 * @returns Delay en ms o undefined si no hay header
 */
export function parseRetryAfterHeader(error: HttpErrorResponse): number | undefined {
    const retryAfter = error.headers?.get('Retry-After');

    if (!retryAfter) {
        return undefined;
    }

    // Retry-After puede ser un número de segundos o una fecha HTTP
    const seconds = parseInt(retryAfter, 10);

    if (!isNaN(seconds)) {
        return seconds * 1000; // Convertir a ms
    }

    // Intentar parsear como fecha HTTP
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
        const delay = date.getTime() - Date.now();
        return delay > 0 ? delay : undefined;
    }

    return undefined;
}
