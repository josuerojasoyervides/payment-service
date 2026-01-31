import { inject, Injectable } from '@angular/core';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { buildStripeDtoFromFakeState } from '@app/features/payments/infrastructure/fake/shared/helpers/build-stripe-dto-from-fake-state.helper';
import { createConfirmedPaypalOrder } from '@app/features/payments/infrastructure/fake/shared/helpers/create-confirmed-paypal-order.helper';
import { createConfirmedStripeIntent } from '@app/features/payments/infrastructure/fake/shared/helpers/create-confirmed-stripe-intent.helper';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { FakeIntentStore } from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.store';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
import type { ConfirmPaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { Observable } from 'rxjs';

@Injectable()
export abstract class FakeConfirmIntentGateway extends PaymentOperationPort<
  ConfirmPaymentRequest,
  any,
  PaymentIntent
> {
  abstract override readonly providerId: PaymentProviderId;

  private readonly fakeIntentStore = inject(FakeIntentStore);

  protected override executeRaw(request: ConfirmPaymentRequest): Observable<any> {
    this.logger.warn(`[FakeGateway] Confirming intent ${request.intentId}`, this.logContext, {
      request,
    });

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createConfirmedPaypalOrder(request.intentId));
    }

    const state = this.fakeIntentStore.get(request.intentId);
    if (state?.scenarioId === 'client_confirm') {
      this.fakeIntentStore.markClientConfirmed(request.intentId);
      const updated = this.fakeIntentStore.refresh(request.intentId);
      const dto = buildStripeDtoFromFakeState(updated ?? state);
      return simulateNetworkDelay(dto);
    }

    return simulateNetworkDelay(createConfirmedStripeIntent(request.intentId));
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
