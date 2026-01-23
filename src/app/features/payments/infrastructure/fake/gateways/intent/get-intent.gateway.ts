import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { GetPaymentStatusRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { createFakePaypalOrderStatus } from '../../helpers/create-fake-paypal-order-status.helper';
import { createFakeStripeIntentStatus } from '../../helpers/create-fake-stripe-intent-status.helper';
import { simulateNetworkDelay } from '../../helpers/simulate-network-delay.helper';

@Injectable()
export class FakeGetIntentGateway extends PaymentOperationPort<
  GetPaymentStatusRequest,
  any,
  PaymentIntent
> {
  readonly providerId: PaymentProviderId = 'stripe';

  protected override executeRaw(request: GetPaymentStatusRequest): Observable<any> {
    console.log(`[FakeGateway] Getting status for ${request.intentId}`);

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createFakePaypalOrderStatus(request.intentId));
    }

    return simulateNetworkDelay(createFakeStripeIntentStatus(request.intentId));
  }
  protected override mapResponse(dto: any): PaymentIntent {
    throw new Error('Method not implemented.');
  }
}
