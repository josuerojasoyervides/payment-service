/**
 * Rate limiting information for an endpoint.
 */
export interface RateLimitInfo {
  /** Number of requests in current window */
  requestCount: number;

  /** Window start timestamp */
  windowStart: number;

  /** Last request timestamp */
  lastRequest: number;
}

/**
 * Rate Limiter configuration.
 */
export interface RateLimiterConfig {
  /** Maximum requests per time window */
  maxRequests: number;

  /** Window duration in ms (default: 60000 = 1 min) */
  windowMs: number;

  /** Whether to apply per endpoint or globally */
  perEndpoint: boolean;
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class RateLimitExceededError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly retryAfter: number,
  ) {
    super(`Rate limit exceeded for endpoint: ${endpoint}. Retry after ${retryAfter}ms`);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Default Rate Limiter configuration.
 */
export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minuto
  perEndpoint: true,
};
