import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { StripePaymentGateway } from './features/payments/infrastructure/providers/stripe-payment.gateway';
import { PAYMENT_GATEWAYS } from './features/payments/infrastructure/providers/payments.token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    StripePaymentGateway,
    {provide: PAYMENT_GATEWAYS, useExisting: StripePaymentGateway, multi: true},
  ]
};
