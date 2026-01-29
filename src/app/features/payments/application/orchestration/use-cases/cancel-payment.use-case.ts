import { inject, Injectable } from '@angular/core';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory.registry';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CancelPaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { safeDefer } from '@shared/rxjs/safe-defer';
import type { Observable } from 'rxjs';

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
