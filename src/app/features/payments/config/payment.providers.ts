import { EnvironmentProviders, Provider } from "@angular/core";
import { PAYMENT_PROVIDER_FACTORIES } from "../application/tokens/payment-provider-factories.token";
import { StripeProviderFactory } from "../infrastructure/stripe/factories/stripe-provider.factory";
import { StripePaymentGateway } from "../infrastructure/stripe/gateways/stripe-payment.gateway";
import { PaypalProviderFactory } from "../infrastructure/paypal/factories/paypal-provider.factory";
import { PaypalPaymentGateway } from "../infrastructure/paypal/gateways/paypal-payment.gateway";
import { FakeStripePaymentGateway } from "../infrastructure/fake/gateway/fake-payment.gateway";
import { PaymentState } from "../ui/state/payments-state";
import { PAYMENTS_STATE } from "../application/tokens/payment-state.token";

const PAYMENT_PROVIDER_FACTORY_PROVIDERS: Provider[] = [
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
    { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
    { provide: StripePaymentGateway, useClass: FakeStripePaymentGateway }, // Remove this, only for testing purposes

    { provide: PAYMENTS_STATE, useClass: PaymentState }

];

export default function providePayments(): (Provider | EnvironmentProviders)[] {
    return [
        StripePaymentGateway,
        PaypalPaymentGateway,
        ...PAYMENT_PROVIDER_FACTORY_PROVIDERS
    ];
}