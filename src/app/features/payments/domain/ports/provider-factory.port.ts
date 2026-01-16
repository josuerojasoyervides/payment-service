import { PaymentMethodType, PaymentProviderId } from "../models/payment.types";
import { PaymentStrategy } from "./payment-strategy.port";

export interface ProviderFactory {
    readonly providerId: PaymentProviderId;

    createStrategy(type: PaymentMethodType): PaymentStrategy;
    // más adelante podrías agregar:
    // createWebhookHandler()
    // createCaptureUseCase()
    // createRefundUseCase()
}
