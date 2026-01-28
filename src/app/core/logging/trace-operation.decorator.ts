import type { LoggerService } from '@core/logging/logger.service';

/**
 * Configuration options for the `TraceOperation` decorator.
 *
 * These options control how the wrapped method is named, which logging
 * context is used and whether it should be measured as a sync or async
 * operation. They are entirely optional – if omitted, sensible defaults
 * are inferred from the target method and class.
 */
export interface TraceOperationOptions {
  /**
   * Custom operation name used when measuring the execution.
   *
   * - If omitted, the original method name (`propertyKey`) is used.
   * - This name will appear in logs emitted by `LoggerService`.
   */
  name?: string;
  /**
   * Explicit logging context to be passed to `LoggerService`.
   *
   * - If omitted, the decorator attempts to derive it from the class name.
   * - Falls back to `'Trace'` when no class name is available.
   */
  context?: string;
  /**
   * Execution mode of the decorated method.
   *
   * - `'async'`: wraps the method with `logger.measure` and expects a Promise.
   * - `'sync'` or `undefined`: wraps the method with `logger.measureSync`.
   *
   * If the mode does not match the actual implementation (e.g. a method
   * returning a Promise but configured as `'sync'`), measurements may not
   * reflect the real execution time.
   */
  mode?: 'sync' | 'async';
  /**
   * Optional function used to extract structured metadata from the
   * invocation arguments.
   *
   * - Receives the raw `args` array passed to the method.
   * - Should return a serialisable object that will be forwarded to
   *   `LoggerService` alongside the measurement.
   * - May return `undefined` when no extra metadata is desired.
   */
  metadata?: (args: unknown[]) => Record<string, unknown> | undefined;
}

/**
 * Method decorator that measures and traces the execution of a method
 * using the feature `LoggerService`.
 *
 * The decorator assumes that the decorated instance exposes a `logger`
 * property compatible with `LoggerService`. When no logger is present,
 * the original method is executed without any tracing side‑effects.
 *
 * By default it:
 * - infers the operation name from the method name,
 * - infers the logging context from the class name,
 * - measures the method as a synchronous operation.
 *
 * Use the `options` argument to override any of these defaults or to attach
 * custom metadata extracted from the invocation arguments.
 *
 * @param options - Optional configuration for the traced operation.
 * @param options.name - Custom operation name used for logging.
 * @param options.context - Explicit logging context; defaults to class name.
 * @param options.mode - Execution mode of the method (`'sync' | 'async'`).
 * @param options.metadata - Function that extracts metadata from `args`.
 * @returns A method decorator that wraps the original method with
 *          `LoggerService.measure` / `measureSync`.
 *
 * @example
 *
 * ```ts
 * // Sync example
 * class IdempotencyKeyFactory {
 *   @TraceOperation({
 *     name: 'generateIdempotencyKey',
 *     context: 'IdempotencyKeyFactory',
 *     mode: 'sync',
 *     metadata: (args) => ({ args }),
 *   })
 *   generate(providerId: PaymentProviderId, input: GenerateInput): string {
 *     // ...
 *   }
 * }
 * ```
 *
 * @example
 *
 *
 * ```ts
 * // Async example
 * class PaymentsApi {
 *   constructor(private readonly logger: LoggerService) {}
 *
 * @TraceOperation({
 *     name: 'createPayment',
 *     mode: 'async',
 *   })
 *   async createPayment(request: CreatePaymentRequest): Promise<Payment> {
 *     // business logic here
 *   }
 * }
 * ```
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
