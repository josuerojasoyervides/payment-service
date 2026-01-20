import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { FakePaymentsBackendInterceptor } from './core/interceptors/fake-backend.interceptor';
import { retryInterceptor } from './core/interceptors/retry.interceptor';
import { resilienceInterceptor } from './core/interceptors/resilience.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';

/**
 * Configuración principal de la aplicación.
 * 
 * Los providers de pagos se cargan de forma lazy con el módulo de payments.
 * Los interceptors globales (retry, resilience, logging) se cargan aquí.
 * 
 * Orden de interceptors (importante):
 * 1. retryInterceptor - Reintenta requests fallidos con backoff
 * 2. resilienceInterceptor - Circuit breaker y rate limiting
 * 3. loggingInterceptor - Logging estructurado
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // HTTP Client con interceptors funcionales y basados en clase
    provideHttpClient(
      // Interceptors funcionales (nuevos)
      withInterceptors([
        retryInterceptor,       // Retry automático con backoff exponencial
        resilienceInterceptor,  // Circuit breaker y rate limiting
        loggingInterceptor,     // Logging estructurado
      ]),
      // Interceptors basados en clase (legacy)
      withInterceptorsFromDi()
    ),

    // Fake backend para desarrollo
    { provide: HTTP_INTERCEPTORS, useClass: FakePaymentsBackendInterceptor, multi: true },
  ]
};
