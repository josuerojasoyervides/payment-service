import { Injectable } from '@angular/core';
import { createFakePaypalOrderStatus } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-paypal-order-status.helper';
import { createFakeStripeIntentStatus } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-stripe-intent-status.helper';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { GetPaymentStatusRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { Observable } from 'rxjs';

@Injectable()
export abstract class FakeGetIntentGateway extends PaymentOperationPort<
  GetPaymentStatusRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: GetPaymentStatusRequest): Observable<any> {
    this.logger.warn(`[FakeGateway] Getting status for ${request.intentId}`, this.logContext, {
      request,
    });
    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createFakePaypalOrderStatus(request.intentId));
    }

    return simulateNetworkDelay(createFakeStripeIntentStatus(request.intentId));
  }
  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
