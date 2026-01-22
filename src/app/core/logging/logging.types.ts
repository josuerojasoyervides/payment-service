/**
 * Supported log levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry.
 *
 * Designed to be JSON serializable and sendable to a logging backend.
 */
export interface LogEntry {
  /** ISO 8601 timestamp */
  timestamp: string;

  /** Severity level */
  level: LogLevel;

  /** Log context/origin (e.g., 'StripeGateway', 'CardStrategy') */
  context: string;

  /** Descriptive message */
  message: string;

  /** Correlation ID to trace complete flows */
  correlationId: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Duration in ms (for measured operations) */
  duration?: number;

  /** Stack trace for errors */
  stack?: string;
}

/**
 * Logger configuration.
 */
export interface LoggerConfig {
  /** Minimum log level to record */
  minLevel: LogLevel;

  /** Whether to include timestamp in console output */
  includeTimestamp: boolean;

  /** Whether to send logs to backend */
  sendToBackend: boolean;

  /** Logging endpoint URL (if sendToBackend is true) */
  backendUrl?: string;

  /** Prefix for all logs */
  prefix?: string;
}

/**
 * Correlation context for tracing.
 *
 * Allows propagating correlationId through nested operations.
 */
export interface CorrelationContext {
  /** Unique correlation ID */
  correlationId: string;

  /** Root operation name */
  operation: string;

  /** Start timestamp */
  startTime: number;

  /** Initial metadata */
  metadata?: Record<string, unknown>;
}

/**
 * HTTP request information for logging.
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
 * Default logger configuration.
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  minLevel: 'debug',
  includeTimestamp: true,
  sendToBackend: false,
};

/**
 * Log level priority (higher = more severe).
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};
