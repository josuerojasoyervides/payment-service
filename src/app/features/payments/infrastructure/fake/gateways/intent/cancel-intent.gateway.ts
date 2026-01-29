import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CancelPaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { createCanceledStripeIntent } from '@payments/infrastructure/fake/helpers/create-canceled-stripe-intent.helper';
import { createVoidedPaypalOrder } from '@payments/infrastructure/fake/helpers/create-voided-paypal-order.helper';
import { simulateNetworkDelay } from '@payments/infrastructure/fake/helpers/simulate-network-delay.helper';
import { mapIntent } from '@payments/infrastructure/fake/mappers/intent.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export abstract class FakeCancelIntentGateway extends PaymentOperationPort<
  CancelPaymentRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: CancelPaymentRequest): Observable<any> {
    this.logger.warn(`[FakeGateway] Canceling intent ${request.intentId}`, this.logContext, {
      request,
    });

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createVoidedPaypalOrder(request.intentId));
    }

    return simulateNetworkDelay(createCanceledStripeIntent(request.intentId));
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
