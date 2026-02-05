import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { GetPaymentStatusRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { PaymentError } from '@payments/domain/subdomains/payment/entities/payment-error.model';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { mapStripeGatewayError } from '@payments/infrastructure/stripe/shared/errors/mappers/stripe-gateway-error.mapper';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import type { Observable } from 'rxjs';
import { timeout } from 'rxjs';

@Injectable()
export class StripeGetIntentGateway extends PaymentOperationPort<
  GetPaymentStatusRequest,
  StripePaymentIntentDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);
  private readonly config = inject(PAYMENTS_INFRA_CONFIG);

  readonly providerId: PaymentProviderId = 'stripe' as const;

  constructor() {
    super();
  }

  protected executeRaw(request: GetPaymentStatusRequest): Observable<StripePaymentIntentDto> {
    const idempotencyKey =
      request.idempotencyKey ??
      this.idempotencyKeyFactory.generateForGet(this.providerId, request.intentId);

    return this.http
      .get<StripePaymentIntentDto>(
        `${this.config.stripe.baseUrl}/intents/${request.intentId.value}`,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      .pipe(timeout({ each: this.config.stripe.timeoutMs }));
  }

  protected mapResponse(dto: StripePaymentIntentDto): PaymentIntent {
    return mapPaymentIntent(dto, this.providerId);
  }

  protected override handleError(err: unknown): PaymentError {
    return mapStripeGatewayError(err, this.config.stripe.timeoutMs);
  }
}
