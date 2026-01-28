import type { HttpErrorResponse } from '@angular/common/http';

/**
 * Retry system configuration with exponential backoff.
 */
export interface RetryConfig {
  /** Maximum number of retries (default: 3) */
  maxRetries: number;

  /** Initial delay in ms before first retry (default: 1000) */
  initialDelay: number;

  /** Maximum delay in ms between retries (default: 30000) */
  maxDelay: number;

  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;

  /** HTTP status codes that are retryable (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatusCodes: number[];

  /** HTTP methods that are retryable (default: ['GET', 'PUT', 'DELETE']) */
  retryableMethods: string[];

  /** Jitter factor to avoid thundering herd (0-1, default: 0.3) */
  jitterFactor: number;
}

/**
 * Information about a retry attempt.
 */
export interface RetryAttemptInfo {
  /** Current attempt number (1-based) */
  attempt: number;

  /** Maximum number of attempts */
  maxAttempts: number;

  /** Calculated delay for this attempt in ms */
  delay: number;

  /** Error that caused the retry */
  error: HttpErrorResponse;

  /** Attempt timestamp */
  timestamp: number;
}

/**
 * Retry state for a specific request.
 */
export interface RetryState {
  /** Request URL */
  url: string;

  /** HTTP method */
  method: string;

  /** Attempts made */
  attempts: RetryAttemptInfo[];

  /** Whether the request finally succeeded */
  succeeded: boolean;

  /** Start timestamp */
  startedAt: number;

  /** End timestamp */
  endedAt?: number;
}

/**
 * Error thrown when retries are exhausted.
 */
export class RetryExhaustedError extends Error {
  constructor(
    public readonly url: string,
    public readonly attempts: number,
    public readonly lastError: HttpErrorResponse,
  ) {
    super(
      `Retry exhausted after ${attempts} attempts for ${url}. ` +
        `Last error: ${lastError.status} ${lastError.statusText}`,
    );
    this.name = 'RetryExhaustedError';
  }
}

/**
 * Default retry configuration.
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
 * Checks if an HTTP error is retryable according to configuration.
 */
export function isRetryableError(error: HttpErrorResponse, config: RetryConfig): boolean {
  return config.retryableStatusCodes.includes(error.status);
}

/**
 * Checks if an HTTP method is retryable according to configuration.
 */
export function isRetryableMethod(method: string, config: RetryConfig): boolean {
  return config.retryableMethods.includes(method.toUpperCase());
}

/**
 * Calculates delay with exponential backoff and jitter.
 *
 * @param attempt Attempt number (1-based)
 * @param config Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  const jitter = config.jitterFactor * cappedDelay;
  const minDelay = cappedDelay - jitter;
  const maxDelay = cappedDelay + jitter;

  return Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
}

/**
 * Extracts Retry-After header value if it exists.
 *
 * @param error HTTP error with possible Retry-After header
 * @returns Delay in ms or undefined if no header
 */
export function parseRetryAfterHeader(error: HttpErrorResponse): number | undefined {
  const retryAfter = error.headers?.get('Retry-After');

  if (!retryAfter) {
    return undefined;
  }

  const seconds = parseInt(retryAfter, 10);

  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    const delay = date.getTime() - Date.now();
    return delay > 0 ? delay : undefined;
  }

  return undefined;
}
