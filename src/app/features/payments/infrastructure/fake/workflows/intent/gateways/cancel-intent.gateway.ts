import { Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { createCanceledStripeIntent } from '@app/features/payments/infrastructure/fake/shared/helpers/create-canceled-stripe-intent.helper';
import { createVoidedPaypalOrder } from '@app/features/payments/infrastructure/fake/shared/helpers/create-voided-paypal-order.helper';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { CancelPaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
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
