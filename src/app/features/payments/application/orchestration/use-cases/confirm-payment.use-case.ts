import { inject, Injectable } from '@angular/core';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { ConfirmPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { Observable } from 'rxjs';

import { safeDefer } from '../../../../../shared/rxjs/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Use case: Confirm a payment.
 *
 * Confirms a PaymentIntent for a specific provider:
 * - Stripe: confirms PaymentIntent
 * - PayPal: captures the approved Order
 *
 * ✅ Fallback does not apply here: intent already exists in a specific provider.
 * On failure, the error is propagated and Store/UI decide how to present it.
 */
@Injectable()
export class ConfirmPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  execute(req: ConfirmPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      const requestWithIdempotency: ConfirmPaymentRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ??
          this.idempotencyKeyFactory.generateForConfirm(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.confirmIntent(requestWithIdempotency);
    });
  }
}
