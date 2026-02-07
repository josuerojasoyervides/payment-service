import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type {
  StripeCreateIntentRequest,
  StripePaymentIntentDto,
  StripeSpeiSourceDto,
} from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { mapStripeGatewayError } from '@app/features/payments/infrastructure/stripe/shared/errors/stripe-gateway-error.mapper';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { PaymentError } from '@payments/domain/subdomains/payment/entities/payment-error.model';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { SpeiSourceMapper } from '@payments/infrastructure/stripe/payment-methods/spei/mappers/spei-source.mapper';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import type { Observable } from 'rxjs';
import { timeout } from 'rxjs';

@Injectable()
export class StripeCreateIntentGateway extends PaymentOperationPort<
  CreatePaymentRequest,
  StripePaymentIntentDto | StripeSpeiSourceDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);
  private readonly config = inject(PAYMENTS_INFRA_CONFIG);
  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.stripe;

  constructor() {
    super();
  }

  protected executeRaw(
    request: CreatePaymentRequest,
  ): Observable<StripePaymentIntentDto | StripeSpeiSourceDto> {
    const stripeRequest = this.buildStripeCreateRequest(request);
    const baseUrl = this.config.stripe.baseUrl;
    const idempotencyKey =
      request.idempotencyKey ??
      this.idempotencyKeyFactory.generateForStart(this.providerId, request);
    const headers = { 'Idempotency-Key': idempotencyKey };

    if (request.method.type === 'spei') {
      return this.http
        .post<StripeSpeiSourceDto>(`${baseUrl}/sources`, stripeRequest, {
          headers,
        })
        .pipe(timeout({ each: this.config.stripe.timeoutMs }));
    }

    return this.http
      .post<StripePaymentIntentDto>(`${baseUrl}/intents`, stripeRequest, {
        headers,
      })
      .pipe(timeout({ each: this.config.stripe.timeoutMs }));
  }
  protected mapResponse(dto: StripePaymentIntentDto | StripeSpeiSourceDto): PaymentIntent {
    if ('spei' in dto) {
      const mapper = new SpeiSourceMapper(
        this.providerId,
        this.config.spei.displayConfig.beneficiaryName,
      );
      return mapper.mapSpeiSource(dto as StripeSpeiSourceDto);
    }
    return mapPaymentIntent(dto as StripePaymentIntentDto, this.providerId);
  }

  private buildStripeCreateRequest(req: CreatePaymentRequest): StripeCreateIntentRequest {
    return {
      amount: Math.round(req.money.amount * 100),
      currency: req.money.currency.toLowerCase(),
      payment_method_types: [req.method.type === 'spei' ? 'spei' : 'card'],
      payment_method: req.method.token,
      metadata: {
        order_id: req.orderId.value,
        created_at: new Date().toISOString(),
      },
      description: `Order ${req.orderId.value}`,
    };
  }

  protected override handleError(err: unknown): PaymentError {
    return mapStripeGatewayError(err, this.config.stripe.timeoutMs);
  }
}
