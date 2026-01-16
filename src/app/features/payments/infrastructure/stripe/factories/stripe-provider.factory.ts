import { inject, Injectable } from '@angular/core';
import { ProviderFactory } from '../../../domain/ports/provider-factory.port';
import { PaymentMethodType } from '../../../domain/models/payment.types';
import { PaymentStrategy } from '../../../domain/ports/payment-strategy.port';
import { StripePaymentGateway } from '../gateways/stripe-payment.gateway';
import { CardStrategy } from '../../../shared/strategies/card-strategy';
import { SpeiStrategy } from '../../../shared/strategies/spei-strategy';

@Injectable()
export class StripeProviderFactory implements ProviderFactory {
    readonly providerId = 'stripe' as const;

    private readonly gateway = inject(StripePaymentGateway);

    createStrategy(type: PaymentMethodType): PaymentStrategy {
        switch (type) {
            case 'card':
                return new CardStrategy(this.gateway);
            case 'spei':
                return new SpeiStrategy(this.gateway);
            default:
                throw new Error(`Payment method type ${type} is not supported for Stripe.`);
        }
    }
}
