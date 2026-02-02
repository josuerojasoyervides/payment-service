import { Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ConfirmPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type {
  StripeConfirmIntentRequest,
  StripePaymentIntentDto,
} from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { STRIPE_API_BASE } from '@app/features/payments/infrastructure/stripe/shared/constants/base-api.constant';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/shared/idempotency/get-idempotency-headers';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
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
      `${StripeConfirmIntentGateway.API_BASE}/intents/${request.intentId.value}/confirm`,
      stripeRequest,
      {
        headers: getIdempotencyHeaders(request.intentId.value, 'confirm', request.idempotencyKey),
      },
    );
  }

  protected mapResponse(dto: StripePaymentIntentDto): PaymentIntent {
    return mapPaymentIntent(dto, this.providerId);
  }
}
