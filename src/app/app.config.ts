import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { cacheInterceptor } from './core/caching';
import { loggingInterceptor } from './core/logging';
import { resilienceInterceptor, retryInterceptor } from './core/resilience';
/**
 * Main application configuration.
 *
 * Payment providers are lazy-loaded with the payments module.
 * Global interceptors (cache, retry, resilience, logging) are registered here.
 *
 * Interceptor order (important):
 * 1. cacheInterceptor - Response cache (avoids unnecessary requests)
 * 2. retryInterceptor - Retries failed requests with backoff
 * 3. resilienceInterceptor - Circuit breaker and rate limiting
 * 4. loggingInterceptor - Structured logging
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // HTTP client with functional and class-based interceptors
    provideHttpClient(
      // Functional interceptors (new)
      withInterceptors([
        cacheInterceptor,
        retryInterceptor,
        resilienceInterceptor, // Circuit breaker and rate limiting
        loggingInterceptor, // Structured logging
      ]),
      // Class-based interceptors (legacy)
      withInterceptorsFromDi(),
    ),
  ],
};
