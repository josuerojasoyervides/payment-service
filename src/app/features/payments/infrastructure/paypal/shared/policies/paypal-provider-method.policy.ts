import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  ProviderMethodPolicy,
  ProviderMethodPolicyPort,
} from '@payments/application/api/ports/provider-method-policy.port';

export class PaypalProviderMethodPolicy implements ProviderMethodPolicyPort {
  readonly providerId: PaymentProviderId = 'paypal';

  getPolicy(method: PaymentMethodType): ProviderMethodPolicy {
    if (method === 'card') {
      return {
        providerId: 'paypal',
        method: 'card',
        requires: {
          returnUrl: true,
          cancelUrl: false,
        },
        flow: {
          usesRedirect: true,
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

    throw new Error(`Unsupported method "${method}" for provider "paypal".`);
  }
}
