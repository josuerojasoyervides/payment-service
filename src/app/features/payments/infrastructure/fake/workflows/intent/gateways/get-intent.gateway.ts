import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { LoggerService } from '@app/core';
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
  unknown,
  PaymentIntent
> {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly fakeIntentStore = inject(FakeIntentStore);

  abstract override readonly providerId: PaymentProviderId;

  protected override executeRaw(request: GetPaymentStatusRequest): Observable<unknown> {
    const id = request.intentId.value;
    this.logger.warn(`[FakeGateway] Getting status for ${id}`, this.logContext, {
      request,
    });
    if (this.providerId === 'paypal') {
      return simulateNetworkDelay(createFakePaypalOrderStatus(id));
    }

    const state = this.fakeIntentStore.get(id);
    if (state) {
      const updated = this.fakeIntentStore.refresh(id);
      const dto = updated
        ? buildStripeDtoFromFakeState(updated)
        : buildStripeDtoFromFakeState(state);
      return simulateNetworkDelay(dto);
    }

    return simulateNetworkDelay(createFakeStripeIntentStatus(id));
  }
  protected override mapResponse(dto: unknown): PaymentIntent {
    return mapIntent(dto, this.providerId);
  }
}
