import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { FakePaymentsBackendInterceptor } from './core/interceptors/fake-backend.interceptor';
import { cacheInterceptor } from './core/interceptors/cache.interceptor';
import { retryInterceptor } from './core/interceptors/retry.interceptor';
import { resilienceInterceptor } from './core/interceptors/resilience.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';

/**
 * Configuración principal de la aplicación.
 * 
 * Los providers de pagos se cargan de forma lazy con el módulo de payments.
 * Los interceptors globales (cache, retry, resilience, logging) se cargan aquí.
 * 
 * Orden de interceptors (importante):
 * 1. cacheInterceptor - Caché de respuestas (evita requests innecesarios)
 * 2. retryInterceptor - Reintenta requests fallidos con backoff
 * 3. resilienceInterceptor - Circuit breaker y rate limiting
 * 4. loggingInterceptor - Logging estructurado
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    // HTTP Client con interceptors funcionales y basados en clase
    provideHttpClient(
      // Interceptors funcionales (nuevos)
      withInterceptors([
        cacheInterceptor,       // Caché de respuestas HTTP
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
