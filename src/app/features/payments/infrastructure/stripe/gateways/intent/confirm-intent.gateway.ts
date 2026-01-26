import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { STRIPE_API_BASE } from '../../constants/base-api.constant';
import { StripeConfirmIntentRequest, StripePaymentIntentDto } from '../../dto/stripe.dto';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';
import { getIdempotencyHeaders } from '../../validators/get-idempotency-headers';

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
