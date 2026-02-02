import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { CancelPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { createCanceledStripeIntent } from '@app/features/payments/infrastructure/fake/shared/helpers/create-canceled-stripe-intent.helper';
import { createVoidedPaypalOrder } from '@app/features/payments/infrastructure/fake/shared/helpers/create-voided-paypal-order.helper';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { Observable } from 'rxjs';

@Injectable()
export abstract class FakeCancelIntentGateway extends PaymentOperationPort<
  CancelPaymentRequest,
  any,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: CancelPaymentRequest): Observable<any> {
    const id = request.intentId.value;
    this.logger.warn(`[FakeGateway] Canceling intent ${id}`, this.logContext, {
      request,
    });

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createVoidedPaypalOrder(id));
    }

    return simulateNetworkDelay(createCanceledStripeIntent(id));
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
