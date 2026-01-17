import { Observable } from "rxjs";
import { PaymentStrategy } from "../../domain/ports/payment-strategy.port";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";
import { PaymentIntent, PaymentMethodType } from "../../domain/models/payment.types";
import { CreatePaymentRequest } from "../../domain/models/payment.requests";

export class CardStrategy implements PaymentStrategy {
    readonly type: PaymentMethodType = 'card';

    constructor(private readonly gateway: PaymentGateway) { }

    start(req: CreatePaymentRequest): Observable<PaymentIntent> {
        return this.gateway.createIntent(req);
    }
}