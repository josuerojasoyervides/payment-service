import { Injectable } from '@angular/core';
import { CreatePaymentRequest, PaymentIntent, PaymentProviderId } from '@payments/domain/models';
import { BasePaymentRefactorGateway } from '@payments/shared/base-payment-refactor.gateway';
import { StripeCreateIntentRequest, StripePaymentIntentDto, StripeSpeiSourceDto } from '../dto/stripe.dto';
import { Observable } from 'rxjs';
import { getIdempotencyHeaders } from '../validators/get-idempotency-headers';
import { SpeiSourceMapper } from '../mappers/spei-source.mapper';
import { STATUS_MAP } from '../mappers/internal-status.mapper';
import { mapStripeNextAction } from '../mappers/next-action.mapper';

@Injectable()
export class StripeCreateIntentGateway extends BasePaymentRefactorGateway<CreatePaymentRequest, StripePaymentIntentDto | StripeSpeiSourceDto, PaymentIntent> {
    readonly providerId: PaymentProviderId = 'stripe' as const;

    private static readonly API_BASE = '/api/payments/stripe';

    constructor() {
        super();
    }

    protected executeRaw(request: CreatePaymentRequest): Observable<StripePaymentIntentDto | StripeSpeiSourceDto> {
        const stripeRequest = this.buildStripeCreateRequest(request);

        if (request.method.type === 'spei') {
            return this.http.post<StripeSpeiSourceDto>(
                `${StripeCreateIntentGateway.API_BASE}/sources`,
                stripeRequest,
                { headers: getIdempotencyHeaders(request.orderId, 'create', request.idempotencyKey) }
            );
        }

        return this.http.post<StripePaymentIntentDto>(
            `${StripeCreateIntentGateway.API_BASE}/intents`,
            stripeRequest,
            { headers: getIdempotencyHeaders(request.orderId, 'create', request.idempotencyKey) }
        );
    }
    protected mapResponse(dto: StripePaymentIntentDto | StripeSpeiSourceDto): PaymentIntent {
        if ('spei' in dto) {
            const mapper = new SpeiSourceMapper(this.providerId);
            return mapper.mapSpeiSource(dto as StripeSpeiSourceDto);
        }
        return this.mapPaymentIntent(dto as StripePaymentIntentDto);
    }


    private mapPaymentIntent(dto: StripePaymentIntentDto): PaymentIntent {
        const status = STATUS_MAP[dto.status] ?? 'processing';

        const intent: PaymentIntent = {
            id: dto.id,
            provider: this.providerId,
            status,
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
            clientSecret: dto.client_secret,
            raw: dto,
        };

        if (dto.next_action) {
            intent.nextAction = mapStripeNextAction(dto);
        }

        return intent;
    }

    private buildStripeCreateRequest(req: CreatePaymentRequest): StripeCreateIntentRequest {
        return {
            amount: Math.round(req.amount * 100),
            currency: req.currency.toLowerCase(),
            payment_method_types: [req.method.type === 'spei' ? 'spei' : 'card'],
            payment_method: req.method.token,
            metadata: {
                order_id: req.orderId,
                created_at: new Date().toISOString(),
            },
            description: `Orden ${req.orderId}`,
        };
    }
}

