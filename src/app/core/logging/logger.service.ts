import { Injectable, InjectionToken, inject } from '@angular/core';
import {
    LogEntry,
    LogLevel,
    LoggerConfig,
    CorrelationContext,
    DEFAULT_LOGGER_CONFIG,
    LOG_LEVEL_PRIORITY,
} from './logging.types';

/**
 * Token para inyectar configuración del logger.
 */
export const LOGGER_CONFIG = new InjectionToken<Partial<LoggerConfig>>('LOGGER_CONFIG');

/**
 * Servicio de logging estructurado.
 * 
 * Características:
 * - Correlation IDs para trazar flujos completos
 * - Output estructurado (JSON) listo para backend
 * - Niveles de log configurables
 * - Medición de duración de operaciones
 * - Context-aware logging
 * 
 * @example
 * ```typescript
 * // Uso básico
 * logger.info('Payment started', 'CheckoutComponent', { orderId: '123' });
 * 
 * // Con correlación
 * const ctx = logger.startCorrelation('payment-flow', { orderId: '123' });
 * logger.info('Creating intent', 'Gateway', {}, ctx.correlationId);
 * logger.endCorrelation(ctx);
 * 
 * // Medir operación
 * const result = await logger.measure('createIntent', async () => {
 *   return gateway.createIntent(req);
 * }, 'StripeGateway');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
    private readonly injectedConfig = inject(LOGGER_CONFIG, { optional: true });
    private readonly config: LoggerConfig;
    private readonly activeCorrelations = new Map<string, CorrelationContext>();

    /** Correlation ID del contexto actual (thread-local simulation) */
    private currentCorrelationId: string | null = null;

    /** Buffer de logs para envío batch al backend */
    private readonly logBuffer: LogEntry[] = [];
    private readonly MAX_BUFFER_SIZE = 100;

    constructor() {
        this.config = { ...DEFAULT_LOGGER_CONFIG, ...this.injectedConfig };
    }

    // ============================================================
    // MÉTODOS PRINCIPALES DE LOGGING
    // ============================================================

    /**
     * Log de nivel debug.
     */
    debug(message: string, context: string, metadata?: Record<string, unknown>, correlationId?: string): void {
        this.log('debug', message, context, metadata, correlationId);
    }

    /**
     * Log de nivel info.
     */
    info(message: string, context: string, metadata?: Record<string, unknown>, correlationId?: string): void {
        this.log('info', message, context, metadata, correlationId);
    }

    /**
     * Log de nivel warn.
     */
    warn(message: string, context: string, metadata?: Record<string, unknown>, correlationId?: string): void {
        this.log('warn', message, context, metadata, correlationId);
    }

    /**
     * Log de nivel error.
     */
    error(message: string, context: string, error?: unknown, metadata?: Record<string, unknown>, correlationId?: string): void {
        const errorMeta = this.extractErrorInfo(error);
        this.log('error', message, context, { ...metadata, ...errorMeta }, correlationId, errorMeta.stack);
    }

    // ============================================================
    // CORRELATION / TRACING
    // ============================================================

    /**
     * Inicia un contexto de correlación para trazar un flujo completo.
     * 
     * @param operation Nombre de la operación (ej: 'payment-flow', 'checkout')
     * @param metadata Metadata inicial del contexto
     * @returns Contexto de correlación
     */
    startCorrelation(operation: string, metadata?: Record<string, unknown>): CorrelationContext {
        const correlationId = this.generateCorrelationId();
        const context: CorrelationContext = {
            correlationId,
            operation,
            startTime: performance.now(),
            metadata,
        };

        this.activeCorrelations.set(correlationId, context);
        this.currentCorrelationId = correlationId;

        this.info(`Starting ${operation}`, 'Correlation', metadata, correlationId);

        return context;
    }

    /**
     * Finaliza un contexto de correlación y loguea la duración total.
     */
    endCorrelation(context: CorrelationContext, metadata?: Record<string, unknown>): void {
        const duration = performance.now() - context.startTime;

        this.info(
            `Completed ${context.operation}`,
            'Correlation',
            { ...context.metadata, ...metadata, totalDuration: Math.round(duration) },
            context.correlationId
        );

        this.activeCorrelations.delete(context.correlationId);

        if (this.currentCorrelationId === context.correlationId) {
            this.currentCorrelationId = null;
        }
    }

    /**
     * Obtiene el correlation ID actual o genera uno nuevo.
     */
    getCorrelationId(): string {
        return this.currentCorrelationId ?? this.generateCorrelationId();
    }

    /**
     * Establece el correlation ID actual para el contexto.
     */
    setCorrelationId(correlationId: string): void {
        this.currentCorrelationId = correlationId;
    }

    /**
     * Limpia el correlation ID actual.
     */
    clearCorrelationId(): void {
        this.currentCorrelationId = null;
    }

    // ============================================================
    // MEDICIÓN DE OPERACIONES
    // ============================================================

    /**
     * Ejecuta una función y mide su duración, logueando el resultado.
     * 
     * @param operationName Nombre de la operación
     * @param fn Función a ejecutar
     * @param context Contexto del log
     * @param metadata Metadata adicional
     */
    async measure<T>(
        operationName: string,
        fn: () => T | Promise<T>,
        context: string,
        metadata?: Record<string, unknown>
    ): Promise<T> {
        const correlationId = this.getCorrelationId();
        const startTime = performance.now();

        this.debug(`Starting ${operationName}`, context, metadata, correlationId);

        try {
            const result = await fn();
            const duration = Math.round(performance.now() - startTime);

            this.info(
                `Completed ${operationName}`,
                context,
                { ...metadata, duration },
                correlationId
            );

            return result;
        } catch (error) {
            const duration = Math.round(performance.now() - startTime);

            this.error(
                `Failed ${operationName}`,
                context,
                error,
                { ...metadata, duration },
                correlationId
            );

            throw error;
        }
    }

    /**
     * Versión síncrona de measure.
     */
    measureSync<T>(
        operationName: string,
        fn: () => T,
        context: string,
        metadata?: Record<string, unknown>
    ): T {
        const correlationId = this.getCorrelationId();
        const startTime = performance.now();

        this.debug(`Starting ${operationName}`, context, metadata, correlationId);

        try {
            const result = fn();
            const duration = Math.round(performance.now() - startTime);

            this.info(
                `Completed ${operationName}`,
                context,
                { ...metadata, duration },
                correlationId
            );

            return result;
        } catch (error) {
            const duration = Math.round(performance.now() - startTime);

            this.error(
                `Failed ${operationName}`,
                context,
                error,
                { ...metadata, duration },
                correlationId
            );

            throw error;
        }
    }

    // ============================================================
    // MÉTODOS INTERNOS
    // ============================================================

    private log(
        level: LogLevel,
        message: string,
        context: string,
        metadata?: Record<string, unknown>,
        correlationId?: string,
        stack?: string
    ): void {
        // Verificar nivel mínimo
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            context,
            message,
            correlationId: correlationId ?? this.currentCorrelationId ?? 'no-correlation',
            metadata,
            stack,
        };

        // Output a consola
        this.writeToConsole(entry);

        // Buffer para backend
        if (this.config.sendToBackend) {
            this.bufferLog(entry);
        }
    }

    private writeToConsole(entry: LogEntry): void {
        const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
        const timestamp = this.config.includeTimestamp ? `[${entry.timestamp}] ` : '';
        const correlation = entry.correlationId !== 'no-correlation'
            ? `[${entry.correlationId.substring(0, 8)}] `
            : '';

        const formattedMessage = `${prefix}${timestamp}${correlation}[${entry.context}] ${entry.message}`;

        const consoleMethod = this.getConsoleMethod(entry.level);

        if (entry.metadata && Object.keys(entry.metadata).length > 0) {
            consoleMethod(formattedMessage, entry.metadata);
        } else {
            consoleMethod(formattedMessage);
        }

        if (entry.stack) {
            console.error(entry.stack);
        }
    }

    private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
        switch (level) {
            case 'debug': return console.debug.bind(console);
            case 'info': return console.info.bind(console);
            case 'warn': return console.warn.bind(console);
            case 'error': return console.error.bind(console);
        }
    }

    private bufferLog(entry: LogEntry): void {
        this.logBuffer.push(entry);

        if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
            this.flushLogs();
        }
    }

    /**
     * Envía los logs buffereados al backend.
     */
    flushLogs(): void {
        if (!this.config.sendToBackend || !this.config.backendUrl || this.logBuffer.length === 0) {
            return;
        }

        const logsToSend = [...this.logBuffer];
        this.logBuffer.length = 0;

        // Usar sendBeacon para garantizar entrega incluso al cerrar la página
        if (navigator.sendBeacon) {
            navigator.sendBeacon(
                this.config.backendUrl,
                JSON.stringify(logsToSend)
            );
        } else {
            fetch(this.config.backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logsToSend),
                keepalive: true,
            }).catch(() => {
                // Silently fail - logging shouldn't break the app
            });
        }
    }

    private generateCorrelationId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `${timestamp}-${random}`;
    }

    private extractErrorInfo(error: unknown): { message?: string; code?: string; stack?: string } {
        if (!error) return {};

        if (error instanceof Error) {
            return {
                message: error.message,
                stack: error.stack,
            };
        }

        if (typeof error === 'object') {
            const err = error as Record<string, unknown>;
            return {
                message: String(err['message'] ?? err['error'] ?? 'Unknown error'),
                code: String(err['code'] ?? ''),
            };
        }

        return { message: String(error) };
    }
}
