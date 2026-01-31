import { inject, Injectable } from '@angular/core';
import { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { GetPaymentStatusRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { safeDefer } from '@shared/rxjs/safe-defer';
import type { Observable } from 'rxjs';

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
