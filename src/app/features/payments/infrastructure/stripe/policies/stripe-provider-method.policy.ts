import type {
  ProviderMethodPolicy,
  ProviderMethodPolicyPort,
} from '@payments/application/api/ports/provider-method-policy.port';
import type {
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

export class StripeProviderMethodPolicy implements ProviderMethodPolicyPort {
  readonly providerId: PaymentProviderId = 'stripe';

  getPolicy(method: PaymentMethodType): ProviderMethodPolicy {
    if (method === 'card') {
      return {
        providerId: 'stripe',
        method: 'card',
        requires: {
          token: true,
        },
        flow: {
          usesRedirect: false,
          requiresUserAction: true,
          supportsPolling: true,
        },
        stages: {
          authorize: true,
          capture: true,
          settle: true,
        },
      };
    }

    if (method === 'spei') {
      return {
        providerId: 'stripe',
        method: 'spei',
        requires: {
          token: false,
        },
        flow: {
          usesRedirect: false,
          requiresUserAction: false,
          supportsPolling: true,
        },
        stages: {
          authorize: true,
          capture: false,
          settle: true,
        },
      };
    }

    throw new Error(`Unsupported method "${method}" for provider "stripe".`);
  }
}
