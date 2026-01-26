import { inject, Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { Observable } from 'rxjs';

import { PAYPAL_API_BASE } from '../../constants/base-api.constant';
import { PaypalOrderDto } from '../../dto/paypal.dto';
import { mapOrder } from '../../mappers/map-order.mapper';

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
      `${this.API_BASE}/orders/${request.intentId}/capture`,
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
