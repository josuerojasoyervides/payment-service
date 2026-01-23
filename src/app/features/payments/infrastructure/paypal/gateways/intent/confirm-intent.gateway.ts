import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { PaypalOrderDto } from '../../dto/paypal.dto';
import { mapOrder } from '../../mappers/map-order.mapper';

@Injectable()
export class PaypalConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly API_BASE = '/api/payments/paypal';

  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected override executeRaw(request: ConfirmPaymentRequest): Observable<PaypalOrderDto> {
    return this.http.post<PaypalOrderDto>(
      `${this.API_BASE}/orders/${request.intentId}/capture`,
      {},
      {
        headers: {
          'PayPal-Request-Id': this.generateRequestId(request.intentId, 'capture'),
        },
      },
    );
  }
  protected override mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }

  // TODO Implement the idempotency key and remove this method
  private generateRequestId(orderId: string, operation = 'create'): string {
    return `${orderId}-${operation}-${Date.now()}`;
  }
}
