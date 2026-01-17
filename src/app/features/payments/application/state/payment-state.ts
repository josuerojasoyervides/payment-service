import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest } from "../../domain/models/payment.requests";
import { PaymentIntent, PaymentProviderId } from "../../domain/models/payment.types";

export type PaymentProcessState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ready'; intent: PaymentIntent }
    | { kind: 'error'; error: unknown };

export type Unsubscribe = () => void;

export abstract class PaymentUIState {
    abstract getSnapshot(): Readonly<PaymentProcessState>;
    abstract subscribe(listener: () => void): Unsubscribe;

    abstract start(req: CreatePaymentRequest, providerId: PaymentProviderId): void;
    abstract confirm(req: ConfirmPaymentRequest): void;
    abstract cancel(req: CancelPaymentRequest): void;
    abstract reset(): void;
}