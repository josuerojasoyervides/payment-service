import type { CircuitBreakerConfig } from '@core/resilience/circuit-breaker';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from '@core/resilience/circuit-breaker';
import type { RateLimiterConfig } from '@core/resilience/rate-limiter';
import { DEFAULT_RATE_LIMITER_CONFIG } from '@core/resilience/rate-limiter';
import type { RetryConfig } from '@core/resilience/retry';
import { DEFAULT_RETRY_CONFIG } from '@core/resilience/retry';

/**
 * Complete resilience configuration.
 */
export interface ResilienceConfig {
  /** Whether to enable circuit breaker */
  enableCircuitBreaker: boolean;

  /** Whether to enable rate limiting */
  enableRateLimiting: boolean;

  /** Whether to enable automatic retry */
  enableRetry: boolean;

  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfig;

  /** Rate limiter configuration */
  rateLimiter: RateLimiterConfig;

  /** Retry configuration */
  retry: RetryConfig;

  /** URL patterns to exclude from resilience */
  excludePatterns: RegExp[];
}

/**
 * Default resilience configuration.
 */
export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  enableCircuitBreaker: true,
  enableRateLimiting: true,
  enableRetry: true,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
  rateLimiter: DEFAULT_RATE_LIMITER_CONFIG,
  retry: DEFAULT_RETRY_CONFIG,
  excludePatterns: [
    /\/health$/, // Health checks
    /\/metrics$/, // Metrics
    /\.json$/, // Static JSON files
  ],
};
