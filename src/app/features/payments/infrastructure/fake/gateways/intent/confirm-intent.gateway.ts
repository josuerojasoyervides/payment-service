import { Injectable } from '@angular/core';
import { PaymentOperationPort } from '@payments/application/ports/payment-operation.port';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { createConfirmedPaypalOrder } from '../../helpers/create-confirmed-paypal-order.helper';
import { createConfirmedStripeIntent } from '../../helpers/create-confirmed-stripe-intent.helper';
import { simulateNetworkDelay } from '../../helpers/simulate-network-delay.helper';
import { mapIntent } from '../../mappers/intent.mapper';

@Injectable()
export abstract class FakeConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: ConfirmPaymentRequest): Observable<any> {
    console.log(`[FakeGateway] Confirming intent ${request.intentId}`);

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createConfirmedPaypalOrder(request.intentId));
    }

    return simulateNetworkDelay(createConfirmedStripeIntent(request.intentId));
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
