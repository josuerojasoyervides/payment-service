import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { STRIPE_API_BASE } from '@payments/infrastructure/stripe/constants/base-api.constant';
import type {
  StripeCreateIntentRequest,
  StripePaymentIntentDto,
  StripeSpeiSourceDto,
} from '@payments/infrastructure/stripe/dto/stripe.dto';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/mappers/payment-intent.mapper';
import { SpeiSourceMapper } from '@payments/infrastructure/stripe/mappers/spei-source.mapper';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/validators/get-idempotency-headers';
import type { Observable } from 'rxjs';

@Injectable()
export class StripeCreateIntentGateway extends PaymentOperationPort<
  CreatePaymentRequest,
  StripePaymentIntentDto | StripeSpeiSourceDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = STRIPE_API_BASE;

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
      description: `Order ${req.orderId}`,
    };
  }
}
