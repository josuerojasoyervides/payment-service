import { inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';

/**
 * Decorator para logging automático de métodos.
 * 
 * NOTA: Los decoradores de método tienen limitaciones en Angular con DI.
 * Este decorator asume que el LoggerService está disponible globalmente.
 * Para uso más robusto, usar logger.measure() directamente.
 * 
 * @param context Nombre del contexto para el log
 * @param options Opciones adicionales
 * 
 * @example
 * ```typescript
 * class PaymentService {
 *   @LogMethod('PaymentService')
 *   async processPayment(req: PaymentRequest) {
 *     // ... implementación
 *   }
 * }
 * ```
 */
export function LogMethod(context: string, options?: LogMethodOptions) {
    return function (
        target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ): PropertyDescriptor {
        const originalMethod = descriptor.value;
        const methodName = options?.operationName ?? propertyKey;

        descriptor.value = function (...args: unknown[]) {
            const startTime = performance.now();
            const correlationId = generateSimpleId();

            // Log de entrada
            logToConsole('debug', context, `Starting ${methodName}`, correlationId, 
                options?.logArgs ? { args: sanitizeArgs(args) } : undefined
            );

            try {
                const result = originalMethod.apply(this, args);

                // Si es una Promise, manejar async
                if (result instanceof Promise) {
                    return result
                        .then((value: unknown) => {
                            const duration = Math.round(performance.now() - startTime);
                            logToConsole('info', context, `Completed ${methodName}`, correlationId, { duration });
                            return value;
                        })
                        .catch((error: unknown) => {
                            const duration = Math.round(performance.now() - startTime);
                            logToConsole('error', context, `Failed ${methodName}`, correlationId, { 
                                duration, 
                                error: error instanceof Error ? error.message : String(error) 
                            });
                            throw error;
                        });
                }

                // Resultado síncrono
                const duration = Math.round(performance.now() - startTime);
                logToConsole('info', context, `Completed ${methodName}`, correlationId, { duration });
                return result;

            } catch (error) {
                const duration = Math.round(performance.now() - startTime);
                logToConsole('error', context, `Failed ${methodName}`, correlationId, { 
                    duration, 
                    error: error instanceof Error ? error.message : String(error) 
                });
                throw error;
            }
        };

        return descriptor;
    };
}

interface LogMethodOptions {
    /** Nombre personalizado de la operación */
    operationName?: string;
    /** Si loguear los argumentos del método */
    logArgs?: boolean;
}

/**
 * Función helper para loguear sin depender de DI.
 */
function logToConsole(
    level: 'debug' | 'info' | 'warn' | 'error',
    context: string,
    message: string,
    correlationId: string,
    metadata?: Record<string, unknown>
): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${correlationId.substring(0, 8)}] [${context}]`;
    
    const consoleMethod = level === 'error' ? console.error 
        : level === 'warn' ? console.warn 
        : level === 'info' ? console.info 
        : console.debug;

    if (metadata) {
        consoleMethod(`${prefix} ${message}`, metadata);
    } else {
        consoleMethod(`${prefix} ${message}`);
    }
}

/**
 * Genera un ID simple para correlación.
 */
function generateSimpleId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

/**
 * Sanitiza argumentos para logging (evita datos sensibles).
 */
function sanitizeArgs(args: unknown[]): unknown[] {
    return args.map(arg => {
        if (arg === null || arg === undefined) return arg;
        
        if (typeof arg === 'object') {
            const sanitized: Record<string, unknown> = {};
            const sensitiveKeys = ['password', 'token', 'secret', 'card', 'cvv', 'cvc'];
            
            for (const [key, value] of Object.entries(arg as Record<string, unknown>)) {
                if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
                    sanitized[key] = '[REDACTED]';
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }
        
        return arg;
    });
}
