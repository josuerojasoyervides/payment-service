import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import providePayments from './features/payments/config/payment.providers';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FakePaymentsBackendInterceptor } from './core/interceptors/fake-backend.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    provideHttpClient(withInterceptorsFromDi()),

    ...providePayments(),
    { provide: HTTP_INTERCEPTORS, useClass: FakePaymentsBackendInterceptor, multi: true },
  ]
};
