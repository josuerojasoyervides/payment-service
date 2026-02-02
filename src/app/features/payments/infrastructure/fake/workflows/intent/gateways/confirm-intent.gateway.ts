import { inject, Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ConfirmPaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { buildStripeDtoFromFakeState } from '@app/features/payments/infrastructure/fake/shared/helpers/build-stripe-dto-from-fake-state.helper';
import { createConfirmedPaypalOrder } from '@app/features/payments/infrastructure/fake/shared/helpers/create-confirmed-paypal-order.helper';
import { createConfirmedStripeIntent } from '@app/features/payments/infrastructure/fake/shared/helpers/create-confirmed-stripe-intent.helper';
import { simulateNetworkDelay } from '@app/features/payments/infrastructure/fake/shared/helpers/simulate-network-delay.helper';
import { mapIntent } from '@app/features/payments/infrastructure/fake/shared/mappers/intent.mapper';
import { FakeIntentStore } from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.store';
import { PaymentOperationPort } from '@payments/application/api/ports/payment-operation.port';
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
    const id = request.intentId.value;
    this.logger.warn(`[FakeGateway] Confirming intent ${id}`, this.logContext, {
      request,
    });

    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createConfirmedPaypalOrder(id));
    }

    const state = this.fakeIntentStore.get(id);
    if (state?.scenarioId === 'client_confirm') {
      this.fakeIntentStore.markClientConfirmed(id);
      const updated = this.fakeIntentStore.refresh(id);
      const dto = buildStripeDtoFromFakeState(updated ?? state);
      return simulateNetworkDelay(dto);
    }

    return simulateNetworkDelay(createConfirmedStripeIntent(id));
  }

  protected override mapResponse(dto: any): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
