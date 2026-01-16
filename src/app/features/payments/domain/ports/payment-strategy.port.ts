import { Observable } from "rxjs";
import { PaymentIntent, PaymentMethodType } from "../models/payment.types";
import { CreatePaymentRequest } from "../models/payment.requests";

export interface PaymentStrategy {
    readonly type: PaymentMethodType;
    start(req: CreatePaymentRequest): Observable<PaymentIntent>;
}
