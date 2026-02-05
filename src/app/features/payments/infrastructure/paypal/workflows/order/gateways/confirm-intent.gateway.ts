import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ConfirmPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { PaymentError } from '@payments/domain/subdomains/payment/entities/payment-error.model';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { mapPaypalGatewayError } from '@payments/infrastructure/paypal/shared/errors/mappers/paypal-gateway-error.mapper';
import { mapOrder } from '@payments/infrastructure/paypal/workflows/order/mappers/map-order.mapper';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import type { Observable } from 'rxjs';
import { timeout } from 'rxjs';

@Injectable()
export class PaypalConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);
  private readonly config = inject(PAYMENTS_INFRA_CONFIG);

  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.paypal;

  protected override executeRaw(request: ConfirmPaymentRequest): Observable<PaypalOrderDto> {
    return this.http
      .post<PaypalOrderDto>(
        `${this.config.paypal.baseUrl}/orders/${request.intentId.value}/capture`,
        {},
        {
          headers: {
            'PayPal-Request-Id': this.idempotencyKeyFactory.generateForConfirm(
              this.providerId,
              request.intentId,
            ),
          },
        },
      )
      .pipe(timeout({ each: this.config.paypal.timeoutMs }));
  }
  protected override mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }

  protected override handleError(err: unknown): PaymentError {
    return mapPaypalGatewayError(err, this.config.paypal.timeoutMs);
  }
}
