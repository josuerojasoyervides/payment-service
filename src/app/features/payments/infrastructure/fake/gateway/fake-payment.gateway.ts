import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { PaymentIntent } from "../../../domain/models/payment.types";
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from "../../../domain/models/payment.requests";
import { PaymentGateway } from "../../../domain/ports/payment-gateway.port";

@Injectable()
export class FakeStripePaymentGateway extends PaymentGateway {
    readonly providerId = 'stripe' as const;

    protected createIntentRaw(req: CreatePaymentRequest): Observable<any> {
        return of({
            id: 'pi_123',
            status: 'requires_payment_method',
            amount: req.amount,
            currency: req.currency,
        });
    }
    protected mapIntent(dto: any): PaymentIntent {
        return this.mapBase(dto);
    }

    protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<any> {
        return of({
            id: req.intentId,
            status: 'processing',
            amount: 100,
            currency: 'MXN',
            clientSecret: 'sec_fake',
        });
    }
    protected mapConfirmIntent(dto: any): PaymentIntent {
        return this.mapBase(dto);
    }

    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<any> {
        return of({
            id: req.intentId,
            status: 'canceled',
            amount: 100,
            currency: 'MXN',
        });
    }
    protected mapCancelIntent(dto: any): PaymentIntent {
        return this.mapBase(dto);
    }

    protected getIntentRaw(req: GetPaymentStatusRequest): Observable<any> {
        return of({
            id: req.intentId,
            status: 'requires_action',
            amount: 100,
            currency: 'MXN',
            redirectUrl: 'https://example.com/redirect',
        });
    }
    protected mapGetIntent(dto: any): PaymentIntent {
        return this.mapBase(dto);
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
            raw: dto,
        };
    }
}
