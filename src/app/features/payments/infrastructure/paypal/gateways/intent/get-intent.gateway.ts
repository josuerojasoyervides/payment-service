import { Injectable } from '@angular/core';
import { PaymentGatewayPort } from '@payments/application/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { GetPaymentStatusRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { PaypalOrderDto } from '../../dto/paypal.dto';
import { mapOrder } from '../../mappers/map-order.mapper';

@Injectable()
export class PaypalGetIntentGateway extends PaymentGatewayPort<
  GetPaymentStatusRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly API_BASE = '/api/payments/paypal';

  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected executeRaw(request: GetPaymentStatusRequest): Observable<PaypalOrderDto> {
    return this.http.get<PaypalOrderDto>(`${this.API_BASE}/orders/${request.intentId}`);
  }
  protected mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }
}
