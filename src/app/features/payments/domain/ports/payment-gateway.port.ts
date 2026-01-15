import { HttpClient } from "@angular/common/http";
import { catchError, map, Observable, throwError } from "rxjs";
import { CreatePaymentRequest, PaymentIntent, PaymentProviderId } from "../models/payment.types";
import { PaymentError } from "../models/payment.errors";

export abstract class PaymentGateway { 
    abstract readonly providerId: PaymentProviderId;

    constructor(protected http: HttpClient) { }
    
    // Método público que usa el resto del sistema
    createIntent(req: CreatePaymentRequest): Observable<PaymentIntent> {
        this.validateCreate(req);
        return this.createIntentRaw(req).pipe(
            map(dto => this.mapIntent(dto)),
            catchError(err => throwError(() => this.normalizeError(err)))
        )
    }

    // ------- Helpers compartidos -------
    protected validateCreate(req: CreatePaymentRequest) { 
        if (!req.orderId) throw new Error("orderId is required");
        if (!req.currency) throw new Error("currency is required");
        if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error("amount is invalid");
        if (!req.method?.type) throw new Error("payment method type is required");
        if (req.method.type === "card" && !req.method.token) throw new Error("card token is required");
    }

    protected normalizeError(err: unknown): PaymentError {
        // base genérico (cada provider puede override)
        return {
            code: "provider_error",
            message: "Payment provider error",
            raw: err
        }
    }

    // ------- “enchufes” para cada provider -------
    protected abstract createIntentRaw(req: CreatePaymentRequest): Observable<any>;
    protected abstract mapIntent(dto: any): PaymentIntent
}