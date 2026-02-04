import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { GetPaymentStatusRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import { mapOrder } from '@payments/infrastructure/paypal/workflows/order/mappers/map-order.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export class PaypalGetIntentGateway extends PaymentOperationPort<
  GetPaymentStatusRequest,
  PaypalOrderDto,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly config = inject(PAYMENTS_INFRA_CONFIG);

  readonly providerId: PaymentProviderId = 'paypal' as const;
  protected executeRaw(request: GetPaymentStatusRequest): Observable<PaypalOrderDto> {
    return this.http.get<PaypalOrderDto>(
      `${this.config.paypal.baseUrl}/orders/${request.intentId.value}`,
    );
  }
  protected mapResponse(dto: PaypalOrderDto): PaymentIntent {
    return mapOrder(dto, this.providerId);
  }
}
