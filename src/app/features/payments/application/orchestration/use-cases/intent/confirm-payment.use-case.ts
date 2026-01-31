import { inject, Injectable } from '@angular/core';
import { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { ConfirmPaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { safeDefer } from '@shared/rxjs/safe-defer';
import type { Observable } from 'rxjs';

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
