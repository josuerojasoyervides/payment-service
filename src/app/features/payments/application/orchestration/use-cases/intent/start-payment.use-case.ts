import { inject, Injectable } from '@angular/core';
import { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { ProviderMethodPolicyRegistry } from '@app/features/payments/application/orchestration/registry/provider-method-policy/provider-method-policy.registry';
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { safeDefer } from '@shared/rxjs/safe-defer';
import type { Observable } from 'rxjs';

@Injectable()
export class StartPaymentUseCase {
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly idempotency = inject(IdempotencyKeyFactory);
  private readonly policyRegistry = inject(ProviderMethodPolicyRegistry);

  execute(
    request: CreatePaymentRequest,
    providerId: PaymentProviderId,
    context?: PaymentFlowContext,
    _wasAutoFallback?: boolean,
  ): Observable<PaymentIntent> {
    return safeDefer(() => {
      const factory = this.registry.get(providerId);
      const policy = this.policyRegistry.getPolicy(providerId, request.method.type);

      if (policy.requires.token && !request.method.token) {
        throw invalidRequestError('errors.card_token_required', {
          field: 'token',
          provider: providerId,
          method: request.method.type,
        });
      }

      if (policy.requires.returnUrl && !context?.returnUrl) {
        throw invalidRequestError('errors.return_url_required', {
          field: 'returnUrl',
          provider: providerId,
          method: request.method.type,
        });
      }

      if (policy.requires.cancelUrl && !context?.cancelUrl) {
        throw invalidRequestError('errors.cancel_url_invalid', {
          field: 'cancelUrl',
          provider: providerId,
          method: request.method.type,
        });
      }

      const strategy = factory.createStrategy(request.method.type);
      const sessionId = context?.flowId ?? null;

      const enrichedRequest: CreatePaymentRequest = {
        ...request,
        metadata: {
          ...(request.metadata ?? {}),
          ...(sessionId ? { sessionId } : {}),
        },
        idempotencyKey: this.idempotency.generateForStart(
          providerId,
          request,
          sessionId ?? undefined,
        ),
      };

      return strategy.start(enrichedRequest, context);
    });
  }
}
