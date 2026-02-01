import { inject, Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { GetPaymentStatusRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { buildStripeDtoFromFakeState } from '@app/features/payments/infrastructure/fake/shared/helpers/build-stripe-dto-from-fake-state.helper';
import { createFakePaypalOrderStatus } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-paypal-order-status.helper';
import { createFakeStripeIntentStatus } from '@app/features/payments/infrastructure/fake/shared/helpers/create-fake-stripe-intent-status.helper';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { FakeIntentStore } from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.store';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { Observable } from 'rxjs';

@Injectable()
export abstract class FakeGetIntentGateway extends PaymentOperationPort<
  GetPaymentStatusRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  private readonly fakeIntentStore = inject(FakeIntentStore);

  protected override executeRaw(request: GetPaymentStatusRequest): Observable<any> {
    this.logger.warn(`[FakeGateway] Getting status for ${request.intentId}`, this.logContext, {
      request,
    });
    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createFakePaypalOrderStatus(request.intentId));
    }

    const state = this.fakeIntentStore.get(request.intentId);
    if (state) {
      const updated = this.fakeIntentStore.refresh(request.intentId);
      const dto = updated
        ? buildStripeDtoFromFakeState(updated)
        : buildStripeDtoFromFakeState(state);
      return simulateNetworkDelay(dto);
    }

    return simulateNetworkDelay(createFakeStripeIntentStatus(request.intentId));
  }
  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
