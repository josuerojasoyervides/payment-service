import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import type { StripePaymentIntentDto } from '@payments/infrastructure/stripe/dto/stripe.dto';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/validators/get-idempotency-headers';
import { STRIPE_API_BASE } from '@payments/infrastructure/stripe/workflows/intent/api/base-api.constant';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import type { Observable } from 'rxjs';

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
