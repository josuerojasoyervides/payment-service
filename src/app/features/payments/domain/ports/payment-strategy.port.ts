import { Observable } from "rxjs";
import { CreatePaymentRequest, PaymentIntent, PaymentMethodType } from "../models/payment.types";

export interface PaymentStrategy { 
    readonly type: PaymentMethodType;
    start(req: CreatePaymentRequest): Observable<PaymentIntent>;
}
