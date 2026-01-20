import { HttpClient } from "@angular/common/http";
import { catchError, map, Observable, tap, throwError } from "rxjs";
import { PaymentIntent, PaymentProviderId } from "../../models/payment/payment-intent.types";
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from "../../models/payment/payment-request.types";
import { PaymentError } from "../../models/payment/payment-error.types";
import { inject } from "@angular/core";
import { LoggerService } from "@core/logging";

export abstract class PaymentGateway<TCreateDto = unknown, TConfirmDto = unknown> {
    abstract readonly providerId: PaymentProviderId;

    protected readonly http = inject(HttpClient);
    protected readonly logger = inject(LoggerService);

    /** Contexto para logging */
    protected get logContext(): string {
        return `${this.providerId}Gateway`;
    }

    // Método público que usa el resto del sistema
    createIntent(req: CreatePaymentRequest): Observable<PaymentIntent> {
        this.validateCreate(req);
        const correlationId = this.logger.getCorrelationId();

        this.logger.info(
            `Creating payment intent`,
            this.logContext,
            { orderId: req.orderId, amount: req.amount, currency: req.currency, method: req.method.type },
            correlationId
        );

        return this.createIntentRaw(req).pipe(
            map(dto => this.mapIntent(dto)),
            tap(intent => {
                this.logger.info(
                    `Payment intent created`,
                    this.logContext,
                    { intentId: intent.id, status: intent.status },
                    correlationId
                );
            }),
            catchError(err => {
                this.logger.error(
                    `Failed to create payment intent`,
                    this.logContext,
                    err,
                    { orderId: req.orderId },
                    correlationId
                );
                return throwError(() => this.normalizeError(err));
            })
        );
    }

    confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent> {
        this.validateConfirm(req);
        const correlationId = this.logger.getCorrelationId();

        this.logger.info(`Confirming intent`, this.logContext, { intentId: req.intentId }, correlationId);

        return this.confirmIntentRaw(req).pipe(
            map(dto => this.mapConfirmIntent(dto)),
            tap(intent => {
                this.logger.info(`Intent confirmed`, this.logContext, { intentId: intent.id, status: intent.status }, correlationId);
            }),
            catchError(err => {
                this.logger.error(`Failed to confirm intent`, this.logContext, err, { intentId: req.intentId }, correlationId);
                return throwError(() => this.normalizeError(err));
            })
        );
    }

    cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent> {
        this.validateCancel(req);
        const correlationId = this.logger.getCorrelationId();

        this.logger.info(`Canceling intent`, this.logContext, { intentId: req.intentId }, correlationId);

        return this.cancelIntentRaw(req).pipe(
            map(dto => this.mapCancelIntent(dto)),
            tap(intent => {
                this.logger.info(`Intent canceled`, this.logContext, { intentId: intent.id, status: intent.status }, correlationId);
            }),
            catchError(err => {
                this.logger.error(`Failed to cancel intent`, this.logContext, err, { intentId: req.intentId }, correlationId);
                return throwError(() => this.normalizeError(err));
            })
        );
    }

    getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent> {
        this.validateGetStatus(req);
        const correlationId = this.logger.getCorrelationId();

        this.logger.debug(`Getting intent status`, this.logContext, { intentId: req.intentId }, correlationId);

        return this.getIntentRaw(req).pipe(
            map(dto => this.mapGetIntent(dto)),
            tap(intent => {
                this.logger.debug(`Got intent status`, this.logContext, { intentId: intent.id, status: intent.status }, correlationId);
            }),
            catchError(err => {
                this.logger.error(`Failed to get intent status`, this.logContext, err, { intentId: req.intentId }, correlationId);
                return throwError(() => this.normalizeError(err));
            })
        );
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
    protected abstract createIntentRaw(req: CreatePaymentRequest): Observable<TCreateDto>;
    protected abstract mapIntent(dto: TCreateDto): PaymentIntent

    protected abstract confirmIntentRaw(req: ConfirmPaymentRequest): Observable<TConfirmDto>;
    protected abstract mapConfirmIntent(dto: TConfirmDto): PaymentIntent;

    protected abstract cancelIntentRaw(req: CancelPaymentRequest): Observable<TConfirmDto>;
    protected abstract mapCancelIntent(dto: TConfirmDto): PaymentIntent;

    protected abstract getIntentRaw(req: GetPaymentStatusRequest): Observable<TConfirmDto>;
    protected abstract mapGetIntent(dto: TConfirmDto): PaymentIntent;
}