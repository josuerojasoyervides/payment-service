import { Injectable } from '@angular/core';
import { PaymentGatewayPort } from '@payments/application/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { StripePaymentIntentDto } from '../../dto/stripe.dto';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';
import { getIdempotencyHeaders } from '../../validators/get-idempotency-headers';

@Injectable()
export class StripeCancelIntentGateway extends PaymentGatewayPort<
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
