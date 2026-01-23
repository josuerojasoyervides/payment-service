import { Injectable } from '@angular/core';
import { CancelPaymentRequest, PaymentIntent, PaymentProviderId } from '@payments/domain/models';
import { PaymentGatewayOperation } from '@payments/shared/payment-operation.gateway';
import { Observable } from 'rxjs';

import { StripePaymentIntentDto } from '../../dto/stripe.dto';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';
import { getIdempotencyHeaders } from '../../validators/get-idempotency-headers';

@Injectable()
export class StripeCancelIntentGateway extends PaymentGatewayOperation<
  CancelPaymentRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = '/api/payments/stripe';

  constructor() {
    super();
  }

  protected executeRaw(request: CancelPaymentRequest): Observable<StripePaymentIntentDto> {
    return this.http.post<StripePaymentIntentDto>(
      `${StripeCancelIntentGateway.API_BASE}/intents/${request.intentId}/cancel`,
      {},
      { headers: getIdempotencyHeaders(request.intentId, 'cancel', request.idempotencyKey) },
    );
  }

  protected mapResponse(dto: StripePaymentIntentDto): PaymentIntent {
    return mapPaymentIntent(dto, this.providerId);
  }
}
