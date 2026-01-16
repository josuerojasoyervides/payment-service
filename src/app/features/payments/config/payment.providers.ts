import { EnvironmentProviders, Provider } from "@angular/core";
import { PAYMENT_PROVIDER_FACTORIES } from "../application/tokens/providers.token";
import { StripeProviderFactory } from "../infrastructure/stripe/factories/stripe-provider.factory";
import { StripePaymentGateway } from "../infrastructure/stripe/gateways/stripe-payment.gateway";
import { PaypalProviderFactory } from "../infrastructure/paypal/factories/paypal-provider.factory";

export default function providePayments(): (Provider | EnvironmentProviders)[] {
    return [
        StripePaymentGateway,
        { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
        { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
    ];
}