import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ConfirmPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type {
  StripeConfirmIntentRequest,
  StripePaymentIntentDto,
} from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/shared/idempotency/get-idempotency-headers';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export class StripeConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly config = inject(PAYMENTS_INFRA_CONFIG);
  readonly providerId: PaymentProviderId = 'stripe' as const;

  constructor() {
    super();
  }

  protected executeRaw(request: ConfirmPaymentRequest): Observable<StripePaymentIntentDto> {
    const stripeRequest: StripeConfirmIntentRequest = {
      return_url: request.returnUrl,
    };

    return this.http.post<StripePaymentIntentDto>(
      `${this.config.stripe.baseUrl}/intents/${request.intentId.value}/confirm`,
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
