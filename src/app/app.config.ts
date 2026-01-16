import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { StripeProviderFactory } from './features/payments/infrastructure/stripe/factories/stripe-provider.factory';
import { PAYMENT_PROVIDER_FACTORIES } from './features/payments/infrastructure/providers.token';
import { StripePaymentGateway } from './features/payments/infrastructure/stripe/gateways/stripe-payment.gateway';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),

    StripePaymentGateway,
    {
      provide: PAYMENT_PROVIDER_FACTORIES,
      useClass: StripeProviderFactory,
      multi: true,
    }
  ]
};
