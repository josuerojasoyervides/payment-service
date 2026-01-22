import { Injectable } from '@angular/core';
import { CreatePaymentRequest, PaymentIntent, PaymentProviderId } from '@payments/domain/models';
import { PaymentGatewayOperation } from '@payments/shared/payment-operation.gateway';
import {
  StripeCreateIntentRequest,
  StripePaymentIntentDto,
  StripeSpeiSourceDto,
} from '../../dto/stripe.dto';
import { Observable } from 'rxjs';
import { getIdempotencyHeaders } from '../../validators/get-idempotency-headers';
import { SpeiSourceMapper } from '../../mappers/spei-source.mapper';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';

@Injectable()
export class StripeCreateIntentGateway extends PaymentGatewayOperation<
  CreatePaymentRequest,
  StripePaymentIntentDto | StripeSpeiSourceDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = '/api/payments/stripe';

  constructor() {
    super();
  }

  protected executeRaw(
    request: CreatePaymentRequest,
  ): Observable<StripePaymentIntentDto | StripeSpeiSourceDto> {
    const stripeRequest = this.buildStripeCreateRequest(request);

    if (request.method.type === 'spei') {
      return this.http.post<StripeSpeiSourceDto>(
        `${StripeCreateIntentGateway.API_BASE}/sources`,
        stripeRequest,
        { headers: getIdempotencyHeaders(request.orderId, 'create', request.idempotencyKey) },
      );
    }

    return this.http.post<StripePaymentIntentDto>(
      `${StripeCreateIntentGateway.API_BASE}/intents`,
      stripeRequest,
      { headers: getIdempotencyHeaders(request.orderId, 'create', request.idempotencyKey) },
    );
  }
  protected mapResponse(dto: StripePaymentIntentDto | StripeSpeiSourceDto): PaymentIntent {
    if ('spei' in dto) {
      const mapper = new SpeiSourceMapper(this.providerId);
      return mapper.mapSpeiSource(dto as StripeSpeiSourceDto);
    }
    return mapPaymentIntent(dto as StripePaymentIntentDto, this.providerId);
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
