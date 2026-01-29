import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { GetPaymentStatusRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { PaypalOrderDto } from '@payments/infrastructure/paypal/dto/paypal.dto';
import { PAYPAL_API_BASE } from '@payments/infrastructure/paypal/workflows/order/api/base-api.constant';
import { mapOrder } from '@payments/infrastructure/paypal/workflows/order/mappers/map-order.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export class PaypalGetIntentGateway extends PaymentOperationPort<
  GetPaymentStatusRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly API_BASE = PAYPAL_API_BASE;

  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected executeRaw(request: GetPaymentStatusRequest): Observable<PaypalOrderDto> {
    return this.http.get<PaypalOrderDto>(`${this.API_BASE}/orders/${request.intentId}`);
  }
  protected mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }
}
