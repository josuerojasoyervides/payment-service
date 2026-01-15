import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { CreatePaymentRequest, PaymentIntent } from "../../domain/models/payment.types";
import { PaymentError } from "../../domain/models/payment.errors";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";

@Injectable()
export class StripePaymentGateway extends PaymentGateway {
    readonly providerId = 'stripe' as const;

    protected createIntentRaw(req: CreatePaymentRequest): Observable<any> {
        return this.http.post('/api/payments/stripe/intents', req);
    }

    protected mapIntent(dto: any): PaymentIntent {
        return {
            id: dto.id,
            provider: 'stripe',
            status: dto.status,
            amount: dto.amount,
            currency: dto.currency,
            clientSecret: dto.clientSecret,
            redirectUrl: dto.redirectUrl,
            raw: dto
        }
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
}
