import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import type { Observable } from 'rxjs';

import { STRIPE_API_BASE } from '../../constants/base-api.constant';
import type { StripePaymentIntentDto } from '../../dto/stripe.dto';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';
import { getIdempotencyHeaders } from '../../validators/get-idempotency-headers';

@Injectable()
export class StripeCancelIntentGateway extends PaymentOperationPort<
  CancelPaymentRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = STRIPE_API_BASE;

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
