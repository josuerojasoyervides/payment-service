import { Injectable } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  ClientConfirmPort,
  ClientConfirmRequest,
} from '@payments/application/api/ports/client-confirm.port';
import { resolveStatusReference } from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import { buildStripeDtoFromFakeState } from '@payments/infrastructure/fake/shared/helpers/build-stripe-dto-from-fake-state.helper';
import { mapIntent } from '@payments/infrastructure/fake/shared/mappers/intent.mapper';
import {
  markFakeIntentClientConfirmed,
  refreshFakeIntentState,
} from '@payments/infrastructure/fake/shared/state/fake-intent.state';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import type { Observable } from 'rxjs';
import { of, throwError } from 'rxjs';

/**
 * Fake Stripe client-confirm port for integration/demo.
 * Marks intent as client-confirmed in fake intent state, advances via refresh, returns intent (no GetPaymentStatusUseCase to avoid circular DI).
 */
@Injectable()
export class FakeStripeClientConfirmPort implements ClientConfirmPort {
  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.stripe;

  execute(request: ClientConfirmRequest): Observable<PaymentIntent> {
    const intentId = resolveStatusReference(request.context, request.providerId);
    if (!intentId) {
      return throwError(
        () => new Error('FakeStripeClientConfirmPort: intentId not found in context.providerRefs'),
      );
    }
    markFakeIntentClientConfirmed(intentId);
    const state = refreshFakeIntentState(intentId);
    if (!state) {
      return throwError(
        () => new Error('FakeStripeClientConfirmPort: intent not found after confirm'),
      );
    }
    const dto = buildStripeDtoFromFakeState(state, 0);
    const intent = mapIntent(dto, PAYMENT_PROVIDER_IDS.stripe);
    return of(intent);
  }
}
