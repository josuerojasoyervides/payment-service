import { Observable } from "rxjs";
import { PaymentMethodType, CreatePaymentRequest, PaymentIntent } from "../../../domain/models/payment.types";
import { PaymentStrategy } from "../../../domain/ports/payment-strategy.port";
import { PaypalPaymentGateway } from "../gateways/paypal-payment.gateway";

export class PaypalRedirectStrategy implements PaymentStrategy {
    type: PaymentMethodType = 'card';

    constructor(private gateway: PaypalPaymentGateway) { }
    start(req: CreatePaymentRequest): Observable<PaymentIntent> {
        throw new Error("Method not implemented.");
    }
}