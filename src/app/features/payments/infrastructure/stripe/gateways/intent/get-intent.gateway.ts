import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { GetPaymentStatusRequest } from '@payments/domain/models/payment/payment-request.types';
import type { Observable } from 'rxjs';

import { STRIPE_API_BASE } from '../../constants/base-api.constant';
import type { StripePaymentIntentDto } from '../../dto/stripe.dto';
import { mapPaymentIntent } from '../../mappers/payment-intent.mapper';

@Injectable()
export class StripeGetIntentGateway extends PaymentOperationPort<
  GetPaymentStatusRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe' as const;

  private static readonly API_BASE = STRIPE_API_BASE;

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
