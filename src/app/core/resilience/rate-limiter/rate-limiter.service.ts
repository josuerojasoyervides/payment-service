import { inject, Injectable, InjectionToken } from '@angular/core';
import { LoggerService } from '@core/logging/logger.service';
import type {
  RateLimiterConfig,
  RateLimitInfo,
} from '@core/resilience/rate-limiter/rate-limiter.types';
import {
  DEFAULT_RATE_LIMITER_CONFIG,
  RateLimitExceededError,
} from '@core/resilience/rate-limiter/rate-limiter.types';

/**
 * Token for injecting Rate Limiter configuration.
 */
export const RATE_LIMITER_CONFIG = new InjectionToken<Partial<RateLimiterConfig>>(
  'RATE_LIMITER_CONFIG',
);

/**
 * Rate limiting service.
 *
 * Implements client-side rate limiting to prevent
 * API request bursts.
 *
 * Features:
 * - Sliding window per endpoint
 * - Configurable per endpoint or globally
 * - Returns estimated wait time
 *
 * @example
 * ```typescript
 * // Check before calling
 * if (rateLimiter.canRequest('/api/payments')) {
 *   rateLimiter.recordRequest('/api/payments');
 *   await makeRequest();
 * } else {
 *   const retryAfter = rateLimiter.getRetryAfter('/api/payments');
 *   console.log(`Wait ${retryAfter}ms before retrying`);
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class RateLimiterService {
  private readonly injectedConfig = inject(RATE_LIMITER_CONFIG, { optional: true });
  private readonly config: RateLimiterConfig;
  private readonly limits = new Map<string, RateLimitInfo>();
  private readonly logger = inject(LoggerService);

  constructor() {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...this.injectedConfig };
  }

  /**
   * Check if a request can be made.
   *
   * @param endpoint Endpoint identifier
   * @returns true if the request can proceed
   */
  canRequest(endpoint: string): boolean {
    const key = this.getKey(endpoint);
    const info = this.getOrCreateInfo(key);
    const now = Date.now();

    this.cleanupWindow(info, now);

    return info.requestCount < this.config.maxRequests;
  }

  /**
   * Records a request made.
   *
   * @param endpoint Endpoint identifier
   * @throws RateLimitExceededError if limit is exceeded
   */
  recordRequest(endpoint: string): void {
    const key = this.getKey(endpoint);
    const info = this.getOrCreateInfo(key);
    const now = Date.now();

    this.cleanupWindow(info, now);

    if (info.requestCount >= this.config.maxRequests) {
      const retryAfter = this.getRetryAfter(endpoint);

      this.logger.warn(`Rate limit exceeded for ${endpoint}`, 'RateLimiter', {
        endpoint,
        requestCount: info.requestCount,
        maxRequests: this.config.maxRequests,
        retryAfter,
      });

      throw new RateLimitExceededError(endpoint, retryAfter);
    }

    info.requestCount++;
    info.lastRequest = now;
  }

  /**
   * Gets time in ms until another request can be made.
   */
  getRetryAfter(endpoint: string): number {
    const key = this.getKey(endpoint);
    const info = this.limits.get(key);

    if (!info) return 0;

    const windowEnd = info.windowStart + this.config.windowMs;
    const now = Date.now();

    if (now >= windowEnd) return 0;

    return windowEnd - now;
  }

  /**
   * Gets rate limit information for an endpoint.
   */
  getLimitInfo(endpoint: string): RateLimitInfo | undefined {
    const key = this.getKey(endpoint);
    return this.limits.get(key);
  }

  /**
   * Gets the number of remaining requests for an endpoint.
   */
  getRemainingRequests(endpoint: string): number {
    const key = this.getKey(endpoint);
    const info = this.limits.get(key);

    if (!info) return this.config.maxRequests;

    const now = Date.now();

    if (now - info.windowStart >= this.config.windowMs) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - info.requestCount);
  }

  /**
   * Resets the counter for an endpoint.
   */
  reset(endpoint: string): void {
    const key = this.getKey(endpoint);
    this.limits.delete(key);
  }

  /**
   * Resets all counters.
   */
  resetAll(): void {
    this.limits.clear();
  }

  private getKey(endpoint: string): string {
    if (!this.config.perEndpoint) {
      return '__global__';
    }

    try {
      const url = new URL(endpoint, window.location.origin);
      return url.pathname;
    } catch {
      return endpoint;
    }
  }

  private getOrCreateInfo(key: string): RateLimitInfo {
    if (!this.limits.has(key)) {
      this.limits.set(key, {
        requestCount: 0,
        windowStart: Date.now(),
        lastRequest: 0,
      });
    }

    return this.limits.get(key)!;
  }

  private cleanupWindow(info: RateLimitInfo, now: number): void {
    if (now - info.windowStart >= this.config.windowMs) {
      info.requestCount = 0;
      info.windowStart = now;
    }
  }
}
