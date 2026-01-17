import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { PaymentGateway } from "../../../domain/ports/payment-gateway.port";
import { PaymentIntent } from "../../../domain/models/payment.types";
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from "../../../domain/models/payment.requests";
import { PaymentError } from "../../../domain/models/payment.errors";

@Injectable()
export class StripePaymentGateway extends PaymentGateway {
    readonly providerId = 'stripe' as const;

    protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<any> {
        return this.http.post('/api/payments/stripe/intents/confirm', req);
    }
    protected mapConfirmIntent(dto: any): PaymentIntent {
        return this.mapBase(dto)
    }

    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<any> {
        return this.http.post('/api/payments/stripe/intents/cancel', req);
    }
    protected mapCancelIntent(dto: any): PaymentIntent {
        return this.mapBase(dto)
    }

    protected getIntentRaw(req: GetPaymentStatusRequest): Observable<any> {
        return this.http.get(`/api/payments/stripe/intents/${req.intentId}`);
    }
    protected mapGetIntent(dto: any): PaymentIntent {
        return this.mapBase(dto)
    }

    protected createIntentRaw(req: CreatePaymentRequest): Observable<any> {
        return this.http.post('/api/payments/stripe/intents', req);
    }
    protected mapIntent(dto: any): PaymentIntent {
        return this.mapBase(dto)
    }

    protected override normalizeError(err: unknown): PaymentError {
        // Ejemplo de normalización específica para Stripe
        if (err && typeof err === 'object' && 'error' in err) {
            const stripeError = (err as any).error;
            return {
                code: stripeError.code || 'provider_error',
                message: stripeError.message || 'Stripe provider error',
                raw: err
            }
        }
        return super.normalizeError(err);
    }

    private mapBase(dto: any): PaymentIntent {
        return {
            id: dto.id,
            provider: this.providerId,
            status: dto.status,
            amount: dto.amount,
            currency: dto.currency,
            clientSecret: dto.clientSecret,
            redirectUrl: dto.redirectUrl,
            raw: dto
        };
    }
}
