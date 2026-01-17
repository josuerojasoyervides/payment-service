import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from "../../domain/models/payment.requests";
import { PaymentIntent, PaymentProviderId } from "../../domain/models/payment.types";

export type PaymentsUiState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; intent: PaymentIntent }
    | { status: "error"; error: unknown };

export type Unsubscribe = () => void;

export interface PaymentStatePort {
    getSnapshot(): Readonly<PaymentsUiState>;
    subscribe(listener: () => void): Unsubscribe;

    start(req: CreatePaymentRequest, providerId: PaymentProviderId): void;
    confirm(req: ConfirmPaymentRequest, providerId: PaymentProviderId): void;
    cancel(req: CancelPaymentRequest, providerId: PaymentProviderId): void;
    refresh(req: GetPaymentStatusRequest, providerId: PaymentProviderId): void;
    reset(): void;
}