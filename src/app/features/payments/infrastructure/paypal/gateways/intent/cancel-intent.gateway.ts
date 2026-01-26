import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { PAYPAL_API_BASE } from '../../constants/base-api.constant';
import { PaypalOrderDto } from '../../dto/paypal.dto';
import { mapOrder } from '../../mappers/map-order.mapper';

@Injectable()
export class PaypalCancelIntentGateway extends PaymentOperationPort<
  CancelPaymentRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly API_BASE = PAYPAL_API_BASE;

  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected override executeRaw(request: CancelPaymentRequest): Observable<PaypalOrderDto> {
    return this.http.post<PaypalOrderDto>(`${this.API_BASE}/orders/${request.intentId}/void`, {});
  }
  protected override mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }
}
