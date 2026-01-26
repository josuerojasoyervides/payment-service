import { inject, Injectable } from '@angular/core';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CancelPaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { Observable } from 'rxjs';

import { safeDefer } from '../../../../../shared/rxjs/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Use case: Cancel a payment.
 *
 * Cancels a PaymentIntent for a specific provider:
 * - Stripe: cancels PaymentIntent
 * - PayPal: void/cancel Order if not captured yet
 *
 * ✅ Fallback does not apply here: intent already lives in a specific provider.
 * On failure, the error is propagated and Store/UI decide how to present it.
 */
@Injectable()
export class CancelPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  execute(req: CancelPaymentRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      const requestWithIdempotency: CancelPaymentRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ??
          this.idempotencyKeyFactory.generateForCancel(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.cancelIntent(requestWithIdempotency);
    });
  }
}
