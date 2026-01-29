import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { GetPaymentStatusRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.types';
import type { StripePaymentIntentDto } from '@payments/infrastructure/stripe/dto/stripe.dto';
import { STRIPE_API_BASE } from '@payments/infrastructure/stripe/workflows/intent/api/base-api.constant';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import type { Observable } from 'rxjs';

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
