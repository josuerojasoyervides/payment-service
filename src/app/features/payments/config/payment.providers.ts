import { EnvironmentProviders, Provider } from "@angular/core";
import { PAYMENT_PROVIDER_FACTORIES } from "../application/tokens/payment-provider-factories.token";
import { StripeProviderFactory } from "../infrastructure/stripe/factories/stripe-provider.factory";
import { StripePaymentGateway } from "../infrastructure/stripe/gateways/stripe-payment.gateway";
import { PaypalProviderFactory } from "../infrastructure/paypal/factories/paypal-provider.factory";
import { PaypalPaymentGateway } from "../infrastructure/paypal/gateways/paypal-payment.gateway";

const PAYMENT_PROVIDER_FACTORY_PROVIDERS: Provider[] = [
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

export default function providePayments(): (Provider | EnvironmentProviders)[] {
    return [
        StripePaymentGateway,
        PaypalPaymentGateway,
        ...PAYMENT_PROVIDER_FACTORY_PROVIDERS
    ];
}