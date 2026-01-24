import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { createCanceledStripeIntent } from '../../helpers/create-canceled-stripe-intent.helper';
import { createVoidedPaypalOrder } from '../../helpers/create-voided-paypal-order.helper';
import { simulateNetworkDelay } from '../../helpers/simulate-network-delay.helper';
import { mapIntent } from '../../mappers/intent.mapper';

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
