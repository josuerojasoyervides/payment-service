import { inject, Injectable } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { invalidRequestError } from '@payments/domain/models/payment/payment-error.factory';
import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';
import { Observable } from 'rxjs';

import { safeDefer } from '../../../../../shared/rxjs/safe-defer';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { ProviderMethodPolicyRegistry } from '../registry/provider-method-policy.registry';

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
        throw invalidRequestError(I18nKeys.errors.card_token_required, {
          field: 'token',
          provider: providerId,
          method: request.method.type,
        });
      }

      if (policy.requires.returnUrl && !context?.returnUrl) {
        throw invalidRequestError(I18nKeys.errors.return_url_required, {
          field: 'returnUrl',
          provider: providerId,
          method: request.method.type,
        });
      }

      if (policy.requires.cancelUrl && !context?.cancelUrl) {
        throw invalidRequestError(I18nKeys.errors.cancel_url_invalid, {
          field: 'cancelUrl',
          provider: providerId,
          method: request.method.type,
        });
      }

      const strategy = factory.createStrategy(request.method.type);

      const enrichedRequest: CreatePaymentRequest = {
        ...request,
        idempotencyKey: this.idempotency.generateForStart(providerId, request),
      };

      return strategy.start(enrichedRequest, context);
    });
  }
}
