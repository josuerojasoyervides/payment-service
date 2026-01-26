import { inject, Injectable } from '@angular/core';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { GetPaymentStatusRequest } from '@payments/domain/models/payment/payment-request.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { Observable } from 'rxjs';

import { safeDefer } from '../../../../../shared/rxjs/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

/**
 * Use case: Get payment status.
 *
 * Fetch current status of a PaymentIntent for a specific provider.
 * - Polling after 3DS
 * - SPEI status checks
 * - UI refresh after PayPal return
 *
 * ✅ Fallback does not apply here: intent already lives in a specific provider.
 * On failure, the error is propagated and Store/UI decide how to present it.
 */
@Injectable()
export class GetPaymentStatusUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotencyKeyFactory = inject(IdempotencyKeyFactory);

  execute(req: GetPaymentStatusRequest, providerId: PaymentProviderId): Observable<PaymentIntent> {
    return safeDefer(() => {
      const requestWithIdempotency: GetPaymentStatusRequest = {
        ...req,
        idempotencyKey:
          req.idempotencyKey ?? this.idempotencyKeyFactory.generateForGet(providerId, req.intentId),
      };

      const gateway = this.registry.get(providerId).getGateway();
      return gateway.getIntent(requestWithIdempotency);
    });
  }
}
