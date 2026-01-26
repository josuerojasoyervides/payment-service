import { inject, Injectable } from '@angular/core';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { Observable } from 'rxjs';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';

@Injectable()
export class StartPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotency = inject(IdempotencyKeyFactory);

  execute(
    request: CreatePaymentRequest,
    providerId: PaymentProviderId,
    context?: PaymentFlowContext,
    _wasAutoFallback?: boolean,
  ): Observable<PaymentIntent> {
    return safeDefer(() => {
      const factory = this.registry.get(providerId);
      const strategy = factory.createStrategy(request.method.type);

      const enrichedRequest: CreatePaymentRequest = {
        ...request,
        idempotencyKey: this.idempotency.generateForStart(providerId, request),
      };

      return strategy.start(enrichedRequest, context);
    });
  }
}
