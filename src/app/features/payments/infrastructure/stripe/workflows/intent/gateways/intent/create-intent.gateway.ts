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
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { SpeiSourceMapper } from '@payments/infrastructure/stripe/payment-methods/spei/mappers/spei-source.mapper';
import { getIdempotencyHeaders } from '@payments/infrastructure/stripe/shared/idempotency/get-idempotency-headers';
import { mapPaymentIntent } from '@payments/infrastructure/stripe/workflows/intent/mappers/payment-intent.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export class StripeCreateIntentGateway extends PaymentOperationPort<
  CreatePaymentRequest,
  StripePaymentIntentDto | StripeSpeiSourceDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly config = inject(PAYMENTS_INFRA_CONFIG);
  readonly providerId: PaymentProviderId = 'stripe' as const;

  constructor() {
    super();
  }

  protected executeRaw(
    request: CreatePaymentRequest,
  ): Observable<StripePaymentIntentDto | StripeSpeiSourceDto> {
    const stripeRequest = this.buildStripeCreateRequest(request);
    const baseUrl = this.config.stripe.baseUrl;

    if (request.method.type === 'spei') {
      return this.http.post<StripeSpeiSourceDto>(`${baseUrl}/sources`, stripeRequest, {
        headers: getIdempotencyHeaders(request.orderId.value, 'create', request.idempotencyKey),
      });
    }

    return this.http.post<StripePaymentIntentDto>(`${baseUrl}/intents`, stripeRequest, {
      headers: getIdempotencyHeaders(request.orderId.value, 'create', request.idempotencyKey),
    });
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
}
