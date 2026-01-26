import { LoggerService } from './logger.service';

export interface TraceOperationOptions {
  /** Custom operation name */
  name?: string;
  /** Override logging context */
  context?: string;
  /** Whether the method is async (Promise-based) */
  mode?: 'sync' | 'async';
  /** Optional metadata extractor */
  metadata?: (args: unknown[]) => Record<string, unknown> | undefined;
}

/**
 * Decorator for tracing method execution with LoggerService.
 *
 * Note: Requires the class to expose a `logger` property.
 */
export function TraceOperation(options: TraceOperationOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const logger = (this as { logger?: LoggerService }).logger;
      if (!logger) {
        return originalMethod.apply(this, args);
      }

      const operationName = options.name ?? propertyKey;
      const context =
        options.context ??
        (this as { constructor?: { name?: string } }).constructor?.name ??
        'Trace';
      const metadata = options.metadata ? options.metadata(args) : undefined;

      if (options.mode === 'async') {
        return logger.measure(
          operationName,
          () => originalMethod.apply(this, args),
          context,
          metadata,
        );
      }

      return logger.measureSync(
        operationName,
        () => originalMethod.apply(this, args),
        context,
        metadata,
      );
    };

    return descriptor;
  };
}
