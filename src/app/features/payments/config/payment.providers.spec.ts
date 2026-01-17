import providePayments from './payment.providers';
import { PAYMENT_PROVIDER_FACTORIES } from '../application/tokens/payment-provider-factories.token';
import { PAYMENTS_STATE } from '../application/tokens/payment-state.token';
import { StripeProviderFactory } from '../infrastructure/stripe/factories/stripe-provider.factory';
import { PaypalProviderFactory } from '../infrastructure/paypal/factories/paypal-provider.factory';
import { PaymentState } from '../ui/state/payments-state';

describe('providePayments', () => {
    it('registers payment providers and state', () => {
        const providers = providePayments();
        const tokens = providers
            .filter((p: any) => p?.provide)
            .map((p: any) => p.provide);

        expect(tokens).toContain(PAYMENT_PROVIDER_FACTORIES);
        expect(tokens).toContain(PAYMENTS_STATE);

        const factories = providers.filter((p: any) => p?.useClass);
        const factoryClasses = factories.map((p: any) => p.useClass);

        expect(factoryClasses).toContain(StripeProviderFactory);
        expect(factoryClasses).toContain(PaypalProviderFactory);
        expect(factoryClasses).toContain(PaymentState);
    });
});