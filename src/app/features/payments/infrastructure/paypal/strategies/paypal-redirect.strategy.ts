import { Observable } from "rxjs";
import { PaymentIntent } from "../../../domain/models/payment.types";
import { CreatePaymentRequest } from "../../../domain/models/payment.requests";
import { PaymentStrategy } from "../../../domain/ports/payment-strategy.port";
import { PaymentGateway } from "../../../domain/ports/payment-gateway.port";

export class PaypalRedirectStrategy implements PaymentStrategy {
    readonly type = 'card' as const;

    constructor(private readonly gateway: PaymentGateway) { }

    start(req: CreatePaymentRequest): Observable<PaymentIntent> {
        return this.gateway.createIntent(req);
    }
}