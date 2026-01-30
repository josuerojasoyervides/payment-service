import { inject, Injectable } from '@angular/core';
import type {
  ClientConfirmPort,
  ClientConfirmRequest,
} from '@payments/application/api/ports/client-confirm.port';
import { resolveStatusReference } from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { buildStripeDtoFromFakeState } from '@payments/infrastructure/fake/shared/helpers/build-stripe-dto-from-fake-state.helper';
import { mapIntent } from '@payments/infrastructure/fake/shared/mappers/intent.mapper';
import { FakeIntentStore } from '@payments/infrastructure/fake/shared/state/fake-intent.store';
import type { Observable } from 'rxjs';
import { of, throwError } from 'rxjs';

/**
 * Fake Stripe client-confirm port for integration/demo.
 * Marks intent as client-confirmed in FakeIntentStore, advances state via refresh, returns intent (no GetPaymentStatusUseCase to avoid circular DI).
 */
@Injectable()
export class FakeStripeClientConfirmPort implements ClientConfirmPort {
  readonly providerId: PaymentProviderId = 'stripe';

  private readonly fakeIntentStore = inject(FakeIntentStore);

  execute(request: ClientConfirmRequest): Observable<PaymentIntent> {
    const intentId = resolveStatusReference(request.context, request.providerId);
    if (!intentId) {
      return throwError(
        () => new Error('FakeStripeClientConfirmPort: intentId not found in context.providerRefs'),
      );
    }
    this.fakeIntentStore.markClientConfirmed(intentId);
    const state = this.fakeIntentStore.refresh(intentId);
    if (!state) {
      return throwError(
        () => new Error('FakeStripeClientConfirmPort: intent not found after confirm'),
      );
    }
    const dto = buildStripeDtoFromFakeState(state, 0);
    const intent = mapIntent(dto, 'stripe');
    return of(intent);
  }
}
