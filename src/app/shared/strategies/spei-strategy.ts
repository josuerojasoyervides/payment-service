import { Observable } from "rxjs";
import { PaymentStrategy } from "../../features/payments/domain/ports/payment-strategy.port";
import { PaymentGateway } from "../../features/payments/domain/ports/payment-gateway.port";
import { CreatePaymentRequest, PaymentIntent } from "../../features/payments/domain/models/payment.types";

export class SpeiStrategy implements PaymentStrategy {
    readonly type = "spei" as const;

    constructor(private readonly gateway: PaymentGateway) { }

    start(req: CreatePaymentRequest): Observable<PaymentIntent> {
        return this.gateway.createIntent(req);
    }
}