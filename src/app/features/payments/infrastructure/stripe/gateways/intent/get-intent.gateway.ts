import { Injectable } from '@angular/core';
import { GetPaymentStatusRequest, PaymentIntent, PaymentProviderId } from '@payments/domain/models';
import { PaymentGatewayOperation } from '@payments/shared/payment-operation.gateway';
import { StripePaymentIntentDto } from '../../dto/stripe.dto';
import { Observable } from 'rxjs';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';

@Injectable()
export class StripeGetIntentGateway extends PaymentGatewayOperation<
  GetPaymentStatusRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = '/api/payments/stripe';

  constructor() {
    super();
  }

  protected executeRaw(request: GetPaymentStatusRequest): Observable<StripePaymentIntentDto> {
    return this.http.get<StripePaymentIntentDto>(
      `${StripeGetIntentGateway.API_BASE}/intents/${request.intentId}`,
    );
  }

  protected mapResponse(dto: StripePaymentIntentDto): PaymentIntent {
    return mapPaymentIntent(dto, this.providerId);
  }
}
