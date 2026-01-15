import { Observable } from "rxjs";
import { PaymentStrategy } from "../../domain/ports/payment-strategy.port";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";
import { CreatePaymentRequest, PaymentIntent } from "../../domain/models/payment.types";

export class CardStrategy implements PaymentStrategy {
    readonly type = "card" as const;

    constructor(private readonly gateway: PaymentGateway) {}

    start(req: CreatePaymentRequest): Observable<PaymentIntent> {
        return this.gateway.createIntent(req);
    }
}