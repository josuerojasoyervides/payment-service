import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { STRIPE_API_BASE } from '@payments/infrastructure/stripe/constants/base-api.constant';
import type {
  StripeConfirmIntentRequest,
  StripePaymentIntentDto,
} from '@payments/infrastructure/stripe/dto/stripe.dto';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/mappers/payment-intent.mapper';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/validators/get-idempotency-headers';
import type { Observable } from 'rxjs';

@Injectable()
export class StripeConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = STRIPE_API_BASE;

  constructor() {
    super();
  }

  protected executeRaw(request: ConfirmPaymentRequest): Observable<StripePaymentIntentDto> {
    const stripeRequest: StripeConfirmIntentRequest = {
      return_url: request.returnUrl,
    };

    return this.http.post<StripePaymentIntentDto>(
      `${StripeConfirmIntentGateway.API_BASE}/intents/${request.intentId}/confirm`,
      stripeRequest,
      { headers: getIdempotencyHeaders(request.intentId, 'confirm', request.idempotencyKey) },
    );
  }

  protected mapResponse(dto: StripePaymentIntentDto): PaymentIntent {
    return mapPaymentIntent(dto, this.providerId);
  }
}
