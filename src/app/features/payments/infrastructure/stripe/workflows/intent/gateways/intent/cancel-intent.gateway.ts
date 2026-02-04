import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CancelPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/shared/idempotency/get-idempotency-headers';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export class StripeCancelIntentGateway extends PaymentOperationPort<
  CancelPaymentRequest,
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

  protected executeRaw(request: CancelPaymentRequest): Observable<StripePaymentIntentDto> {
    return this.http.post<StripePaymentIntentDto>(
      `${this.config.stripe.baseUrl}/intents/${request.intentId.value}/cancel`,
      {},
      { headers: getIdempotencyHeaders(request.intentId.value, 'cancel', request.idempotencyKey) },
    );
  }

  protected mapResponse(dto: StripePaymentIntentDto): PaymentIntent {
    return mapPaymentIntent(dto, this.providerId);
  }
}
