import { PaymentMethodType, PaymentProviderId } from "../models/payment.types";
import { PaymentGateway } from "./payment-gateway.port";
import { PaymentStrategy } from "./payment-strategy.port";

export interface ProviderFactory {
    readonly providerId: PaymentProviderId;

    getGateway(): PaymentGateway;
    createStrategy(type: PaymentMethodType): PaymentStrategy;
}
