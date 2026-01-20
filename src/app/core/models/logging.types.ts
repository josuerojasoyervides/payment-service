/**
 * Niveles de log soportados.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Entrada de log estructurada.
 * 
 * Diseñada para ser serializable a JSON y enviar a un backend de logging.
 */
export interface LogEntry {
    /** Timestamp ISO 8601 */
    timestamp: string;
    
    /** Nivel de severidad */
    level: LogLevel;
    
    /** Contexto/origen del log (ej: 'StripeGateway', 'CardStrategy') */
    context: string;
    
    /** Mensaje descriptivo */
    message: string;
    
    /** ID de correlación para trazar flujos completos */
    correlationId: string;
    
    /** Metadata adicional */
    metadata?: Record<string, unknown>;
    
    /** Duración en ms (para operaciones medidas) */
    duration?: number;
    
    /** Stack trace para errores */
    stack?: string;
}

/**
 * Configuración del logger.
 */
export interface LoggerConfig {
    /** Nivel mínimo de log a registrar */
    minLevel: LogLevel;
    
    /** Si incluir timestamp en console output */
    includeTimestamp: boolean;
    
    /** Si enviar logs al backend */
    sendToBackend: boolean;
    
    /** URL del endpoint de logging (si sendToBackend es true) */
    backendUrl?: string;
    
    /** Prefijo para todos los logs */
    prefix?: string;
}

/**
 * Contexto de correlación para tracing.
 * 
 * Permite propagar el correlationId a través de operaciones anidadas.
 */
export interface CorrelationContext {
    /** ID único de correlación */
    correlationId: string;
    
    /** Nombre de la operación raíz */
    operation: string;
    
    /** Timestamp de inicio */
    startTime: number;
    
    /** Metadata inicial */
    metadata?: Record<string, unknown>;
}

/**
 * Información de un request HTTP para logging.
 */
export interface HttpLogInfo {
    method: string;
    url: string;
    status?: number;
    duration?: number;
    requestBody?: unknown;
    responseBody?: unknown;
    error?: unknown;
}

/**
 * Configuración por defecto del logger.
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
    minLevel: 'debug',
    includeTimestamp: true,
    sendToBackend: false,
};

/**
 * Prioridad de niveles de log (mayor = más severo).
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
