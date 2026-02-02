import { inject, Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ConfirmPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PAYPAL_API_BASE } from '@app/features/payments/infrastructure/paypal/shared/constants/base-api.constant';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { mapOrder } from '@payments/infrastructure/paypal/workflows/order/mappers/map-order.mapper';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import type { Observable } from 'rxjs';

@Injectable()
export class PaypalConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly API_BASE = PAYPAL_API_BASE;

  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);
  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected override executeRaw(request: ConfirmPaymentRequest): Observable<PaypalOrderDto> {
    return this.http.post<PaypalOrderDto>(
      `${this.API_BASE}/orders/${request.intentId.value}/capture`,
      {},
      {
        headers: {
          'PayPal-Request-Id': this.idempotencyKeyFactory.generateForConfirm(
            this.providerId,
            request.intentId,
          ),
        },
      },
    );
  }
  protected override mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }
}
