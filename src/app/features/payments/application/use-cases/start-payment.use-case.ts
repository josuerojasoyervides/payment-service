import { inject, Injectable } from '@angular/core';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { EMPTY, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

function isPaymentError(e: unknown): e is PaymentError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e;
}

@Injectable()
export class StartPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly fallback = inject(FallbackOrchestratorService);
  private readonly idempotency = inject(IdempotencyKeyFactory);

  execute(
    request: CreatePaymentRequest,
    providerId: PaymentProviderId,
    context?: PaymentFlowContext,
    wasAutoFallback?: boolean,
  ): Observable<PaymentIntent> {
    return safeDefer(() => {
      const factory = this.registry.get(providerId);
      const strategy = factory.createStrategy(request.method.type);

      const enrichedRequest: CreatePaymentRequest = {
        ...request,
        idempotencyKey: this.idempotency.generateForStart(providerId, request),
      };

      return strategy.start(enrichedRequest, context).pipe(
        catchError((error: unknown) => {
          if (isPaymentError(error)) {
            const didFallback = this.fallback.reportFailure({
              providerId,
              error,
              request: enrichedRequest,
              wasAutoFallback,
            });

            if (didFallback) return EMPTY;
          }

          return throwError(() => error);
        }),
      );
    });
  }
}
