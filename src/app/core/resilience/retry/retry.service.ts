import type { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';

import { LoggerService } from '../../logging/logger.service';
import type { RetryAttemptInfo, RetryConfig, RetryState } from './retry.types';
import {
  calculateBackoffDelay,
  DEFAULT_RETRY_CONFIG,
  isRetryableError,
  isRetryableMethod,
  parseRetryAfterHeader,
} from './retry.types';

/**
 * Token for injecting Retry configuration.
 */
export const RETRY_CONFIG = new InjectionToken<Partial<RetryConfig>>('RETRY_CONFIG');

/**
 * Retry service with exponential backoff.
 *
 * Implements automatic retry logic for HTTP requests
 * with exponential backoff and jitter to avoid thundering herd.
 *
 * Features:
 * - Configurable exponential backoff
 * - Jitter to spread retries
 * - Respects Retry-After header
 * - LoggerService integration
 * - Retry state tracking
 *
 * @example
 * ```typescript
 * // Check if it should retry
 * if (retryService.shouldRetry(error, 'GET', attempt)) {
 *   const delay = retryService.getDelay(attempt, error);
 *   await sleep(delay);
 *   // Retry...
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class RetryService {
  private readonly injectedConfig = inject(RETRY_CONFIG, { optional: true });
  private readonly config: RetryConfig;
  private readonly logger = inject(LoggerService);

  /** Retry state per URL (for debugging/observability) */
  private readonly retryStates = new Map<string, RetryState>();

  constructor() {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...this.injectedConfig };
  }

  /**
   * Get the current retry configuration.
   */
  getConfig(): Readonly<RetryConfig> {
    return this.config;
  }

  /**
   * Determine if a request should be retried.
   *
   * @param error HTTP error that occurred
   * @param method HTTP method of the request
   * @param attempt Current attempt number (1-based)
   * @returns true if it should retry
   */
  shouldRetry(error: HttpErrorResponse, method: string, attempt: number): boolean {
    // Check if attempts remain
    if (attempt >= this.config.maxRetries) {
      this.logger.debug(`Max retries (${this.config.maxRetries}) reached`, 'RetryService', {
        attempt,
        maxRetries: this.config.maxRetries,
      });
      return false;
    }

    if (!isRetryableMethod(method, this.config)) {
      this.logger.debug(`Method ${method} is not retryable`, 'RetryService', {
        method,
        retryableMethods: this.config.retryableMethods,
      });
      return false;
    }

    if (!isRetryableError(error, this.config)) {
      this.logger.debug(`Status ${error.status} is not retryable`, 'RetryService', {
        status: error.status,
        retryableStatusCodes: this.config.retryableStatusCodes,
      });
      return false;
    }

    return true;
  }

  /**
   * Calculate delay for the next attempt.
   *
   * @param attempt Attempt number (1-based)
   * @param error HTTP error (optional, to read Retry-After)
   * @returns Delay in milliseconds
   */
  getDelay(attempt: number, error?: HttpErrorResponse): number {
    // Prefer Retry-After header if present
    if (error) {
      const retryAfter = parseRetryAfterHeader(error);
      if (retryAfter !== undefined) {
        this.logger.debug(`Using Retry-After header: ${retryAfter}ms`, 'RetryService', {
          retryAfter,
          attempt,
        });
        return Math.min(retryAfter, this.config.maxDelay);
      }
    }

    // Calculate exponential backoff with jitter
    return calculateBackoffDelay(attempt, this.config);
  }

  /**
   * Record a retry attempt for tracking.
   *
   * @param url Request URL
   * @param method HTTP method
   * @param attempt Attempt number
   * @param delay Delay used
   * @param error Error that triggered the retry
   */
  recordAttempt(
    url: string,
    method: string,
    attempt: number,
    delay: number,
    error: HttpErrorResponse,
  ): void {
    const key = `${method}:${url}`;
    let state = this.retryStates.get(key);

    if (!state || attempt === 1) {
      state = {
        url,
        method,
        attempts: [],
        succeeded: false,
        startedAt: Date.now(),
      };
      this.retryStates.set(key, state);
    }

    const attemptInfo: RetryAttemptInfo = {
      attempt,
      maxAttempts: this.config.maxRetries,
      delay,
      error,
      timestamp: Date.now(),
    };

    state.attempts.push(attemptInfo);

    this.logger.warn(`Retry attempt ${attempt}/${this.config.maxRetries}`, 'RetryService', {
      url,
      method,
      attempt,
      delay,
      status: error.status,
      statusText: error.statusText,
    });
  }

  /**
   * Marca un retry como exitoso.
   */
  recordSuccess(url: string, method: string): void {
    const key = `${method}:${url}`;
    const state = this.retryStates.get(key);

    if (state) {
      state.succeeded = true;
      state.endedAt = Date.now();

      const totalTime = state.endedAt - state.startedAt;
      const totalAttempts = state.attempts.length + 1;

      this.logger.info(`Request succeeded after ${totalAttempts} attempt(s)`, 'RetryService', {
        url,
        method,
        totalAttempts,
        totalTime,
      });
    }
  }

  /**
   * Marca un retry como fallido (agotado).
   */
  recordFailure(url: string, method: string): void {
    const key = `${method}:${url}`;
    const state = this.retryStates.get(key);

    if (state) {
      state.succeeded = false;
      state.endedAt = Date.now();

      const totalTime = state.endedAt - state.startedAt;

      this.logger.error(
        `Request failed after ${state.attempts.length} retry attempts`,
        'RetryService',
        null,
        {
          url,
          method,
          totalAttempts: state.attempts.length,
          totalTime,
        },
      );
    }
  }

  /**
   * Get retry state for a specific URL.
   */
  getRetryState(url: string, method: string): RetryState | undefined {
    return this.retryStates.get(`${method}:${url}`);
  }

  /**
   * Get all active retry states.
   */
  getAllRetryStates(): Map<string, RetryState> {
    return new Map(this.retryStates);
  }

  /**
   * Clear retry state for a specific URL.
   */
  clearRetryState(url: string, method: string): void {
    this.retryStates.delete(`${method}:${url}`);
  }

  /**
   * Clear all retry states.
   */
  clearAllRetryStates(): void {
    this.retryStates.clear();
  }

  /**
   * Create a delay promise for async/await.
   */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
