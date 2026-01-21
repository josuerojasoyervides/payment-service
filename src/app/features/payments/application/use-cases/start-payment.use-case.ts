import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

import {
    CreatePaymentRequest,
    PaymentProviderId,
    PaymentError,
    PaymentIntent,
    PaymentFlowContext,
} from '../../domain/models';

import { IdempotencyKeyFactory } from '../../shared/idempotency/idempotency-key.factory';
import { safeDefer } from '../helpers/safe-defer';

function isPaymentError(e: unknown): e is PaymentError {
    return typeof e === 'object' && e !== null && 'code' in e && 'message' in e;
}

@Injectable({ providedIn: 'root' })
export class StartPaymentUseCase {
    private readonly registry = inject(ProviderFactoryRegistry);
    private readonly fallback = inject(FallbackOrchestratorService);
    private readonly idempotency = inject(IdempotencyKeyFactory);

    execute(
        request: CreatePaymentRequest,
        providerId: PaymentProviderId,
        context?: PaymentFlowContext,
        wasAutoFallback?: boolean
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
                })
            );
        });
    }
}
