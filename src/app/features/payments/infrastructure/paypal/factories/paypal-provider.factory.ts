import { inject, Injectable } from "@angular/core";
import { PaymentMethodType } from "../../../domain/models/payment.types";
import { ProviderFactory } from "../../../domain/ports/provider-factory.port";
import { PaypalPaymentGateway } from "../gateways/paypal-payment.gateway";
import { PaypalRedirectStrategy } from "../strategies/paypal-redirect.strategy";
import { PaymentStrategy } from "../../../domain/ports/payment-strategy.port";

@Injectable()
export class PaypalProviderFactory implements ProviderFactory {
    providerId = 'paypal' as const;

    private readonly gateway = inject(PaypalPaymentGateway)

    createStrategy(type: PaymentMethodType): PaymentStrategy {
        switch (type) {
            case 'card': return new PaypalRedirectStrategy(this.gateway);
            default: throw new Error(`Unsupported payment method type: ${type}`);
        }
    }
}
