/**
 * Possible Circuit Breaker states.
 *
 * - closed: Normal operation, calls pass through
 * - open: Circuit open, calls are rejected immediately
 * - half-open: Test state, allows one call to verify recovery
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Information about a specific circuit's state.
 */
export interface CircuitInfo {
  /** Current circuit state */
  state: CircuitState;

  /** Consecutive failures counter */
  failures: number;

  /** Last failure timestamp */
  lastFailure: number;

  /** Timestamp when circuit was opened */
  openedAt?: number;

  /** Consecutive successes counter (in half-open) */
  successes: number;
}

/**
 * Circuit Breaker configuration.
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;

  /** Time in ms to consider a failure as "recent" (default: 30000) */
  failureWindow: number;

  /** Time in ms before attempting half-open (default: 60000) */
  resetTimeout: number;

  /** Number of successes in half-open to close circuit (default: 2) */
  successThreshold: number;

  /** HTTP status codes that count as failure (default: 5xx) */
  failureStatusCodes: number[];
}

/**
 * Error thrown when circuit is open.
 */
export class CircuitOpenError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly circuitInfo: CircuitInfo,
  ) {
    super(`Circuit breaker is open for endpoint: ${endpoint}`);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Default Circuit Breaker configuration.
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindow: 30000, // 30 segundos
  resetTimeout: 60000, // 1 minuto
  successThreshold: 2,
  failureStatusCodes: [500, 502, 503, 504],
};
