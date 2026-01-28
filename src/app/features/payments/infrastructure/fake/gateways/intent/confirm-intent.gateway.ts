import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { createConfirmedPaypalOrder } from '@payments/infrastructure/fake/helpers/create-confirmed-paypal-order.helper';
import { createConfirmedStripeIntent } from '@payments/infrastructure/fake/helpers/create-confirmed-stripe-intent.helper';
import { simulateNetworkDelay } from '@payments/infrastructure/fake/helpers/simulate-network-delay.helper';
import { mapIntent } from '@payments/infrastructure/fake/mappers/intent.mapper';
import type { Observable } from 'rxjs';

@Injectable()
export abstract class FakeConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: ConfirmPaymentRequest): Observable<any> {
    this.logger.warn(`[FakeGateway] Confirming intent ${request.intentId}`, this.logContext, {
      request,
    });

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createConfirmedPaypalOrder(request.intentId));
    }

    return simulateNetworkDelay(createConfirmedStripeIntent(request.intentId));
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
