import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { PaymentIntent } from "../../../domain/models/payment.types";
import { CreatePaymentRequest } from "../../../domain/models/payment.requests";
import { PaymentGateway } from "../../../domain/ports/payment-gateway.port";

@Injectable()
export class FakeStripePaymentGateway extends PaymentGateway {
    readonly providerId = 'stripe' as const;

    protected createIntentRaw(req: CreatePaymentRequest): Observable<any> {
        return of({
            id: 'pi_fake_stripe',
            status: 'requires_payment_method',
            amount: req.amount,
            currency: req.currency,
            clientSecret: 'sec_fake',
        });
    }

    protected mapIntent(dto: any): PaymentIntent {
        return {
            id: dto.id,
            provider: 'stripe',
            status: dto.status,
            amount: dto.amount,
            currency: dto.currency,
            clientSecret: dto.clientSecret,
            raw: dto,
        };
    }
}
