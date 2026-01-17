import { HttpClient } from "@angular/common/http";
import { catchError, map, Observable, throwError } from "rxjs";
import { PaymentIntent, PaymentProviderId } from "../models/payment.types";
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from "../models/payment.requests";
import { PaymentError } from "../models/payment.errors";
import { inject } from "@angular/core";

export abstract class PaymentGateway {
    abstract readonly providerId: PaymentProviderId;

    protected readonly http = inject(HttpClient);

    // Método público que usa el resto del sistema
    createIntent(req: CreatePaymentRequest): Observable<PaymentIntent> {
        this.validateCreate(req);
        return this.createIntentRaw(req).pipe(
            map(dto => this.mapIntent(dto)),
            catchError(err => throwError(() => this.normalizeError(err)))
        )
    }

    confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent> {
        this.validateConfirm(req);
        return this.confirmIntentRaw(req).pipe(
            map(dto => this.mapConfirmIntent(dto)),
            catchError(err => throwError(() => this.normalizeError(err)))
        )
    }

    cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent> {
        this.validateCancel(req);
        return this.cancelIntentRaw(req).pipe(
            map(dto => this.mapCancelIntent(dto)),
            catchError(err => throwError(() => this.normalizeError(err)))
        )
    }

    getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent> {
        this.validateGetStatus(req);
        return this.getIntentRaw(req).pipe(
            map(dto => this.mapGetIntent(dto)),
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

    protected validateConfirm(req: ConfirmPaymentRequest) {
        if (!req.intentId) throw new Error("intentId is required");
    }

    protected validateCancel(req: CancelPaymentRequest) {
        if (!req.intentId) throw new Error("intentId is required");
    }

    protected validateGetStatus(req: GetPaymentStatusRequest) {
        if (!req.intentId) throw new Error("intentId is required");
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

    protected abstract confirmIntentRaw(req: ConfirmPaymentRequest): Observable<any>;
    protected abstract mapConfirmIntent(dto: any): PaymentIntent;

    protected abstract cancelIntentRaw(req: CancelPaymentRequest): Observable<any>;
    protected abstract mapCancelIntent(dto: any): PaymentIntent;

    protected abstract getIntentRaw(req: GetPaymentStatusRequest): Observable<any>;
    protected abstract mapGetIntent(dto: any): PaymentIntent;
}