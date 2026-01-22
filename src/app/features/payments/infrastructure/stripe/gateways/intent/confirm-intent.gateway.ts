import { Injectable } from '@angular/core';
import { ConfirmPaymentRequest, PaymentIntent, PaymentProviderId } from '@payments/domain/models';
import { PaymentGatewayOperation } from '@payments/shared/payment-operation.gateway';
import { StripeConfirmIntentRequest, StripePaymentIntentDto } from '../../dto/stripe.dto';
import { Observable } from 'rxjs';
import { getIdempotencyHeaders } from '../../validators/get-idempotency-headers';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';

@Injectable()
export class StripeConfirmIntentGateway extends PaymentGatewayOperation<
  ConfirmPaymentRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = '/api/payments/stripe';

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
