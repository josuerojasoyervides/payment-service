import { inject, Injectable } from '@angular/core';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { PaymentMethodType, PaymentProviderId } from '../../domain/models/payment.types';
import { PaymentStrategy } from '../../domain/ports/payment-strategy.port';
import { CardStrategy } from '../../infrastructure/strategies/card-strategy';
import { SpeiStrategy } from '../../infrastructure/strategies/spei-strategy';

@Injectable({providedIn: 'root'})
export class PaymentStrategyFactory {

    private readonly gatewayFactory = inject(PaymentGatewayFactory);

    create(provider: PaymentProviderId, type: PaymentMethodType): PaymentStrategy  {
        const gateway = this.gatewayFactory.get(provider);

        switch (type) {
            case 'card': return new CardStrategy(gateway);
            case 'spei': return new SpeiStrategy(gateway);
            default: throw new Error(`Payment method type ${type} is not supported.`);
        }
    }
}