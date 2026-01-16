import { Injectable } from '@angular/core';
import { CreatePaymentRequest, PaymentIntent } from '../../../domain/models/payment.types';
import { PaymentGateway } from '../../../domain/ports/payment-gateway.port';
import { Observable } from 'rxjs';
import { PaymentError } from '../../../domain/models/payment.errors';

@Injectable()
export class PaypalPaymentGateway extends PaymentGateway {
    readonly providerId = 'paypal' as const;

    protected createIntentRaw(req: CreatePaymentRequest): Observable<any> {
        return this.http.post('/api/payments/paypal/intents', req);
    }

    protected mapIntent(dto: any): PaymentIntent {
        return {
            id: dto.id,
            provider: 'paypal',
            status: dto.status,
            amount: dto.amount,
            currency: dto.currency,
            clientSecret: dto.clientSecret,
            redirectUrl: dto.redirectUrl,
            raw: dto
        }
    }

    protected override normalizeError(err: unknown): PaymentError {
        // Ejemplo de normalización específica para PayPal
        if (err && typeof err === 'object' && 'error' in err) {
            const paypalError = (err as any).error;
            return {
                code: paypalError.code || 'provider_error',
                message: paypalError.message || 'PayPal provider error',
                raw: err
            }
        }
        return super.normalizeError(err);
    }
}