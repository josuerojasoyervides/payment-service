import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  ProviderMethodPolicy,
  ProviderMethodPolicyPort,
} from '@payments/application/api/ports/provider-method-policy.port';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

export class StripeProviderMethodPolicy implements ProviderMethodPolicyPort {
  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.stripe;

  getPolicy(method: PaymentMethodType): ProviderMethodPolicy {
    if (method === 'card') {
      return {
        providerId: PAYMENT_PROVIDER_IDS.stripe,
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
        providerId: PAYMENT_PROVIDER_IDS.stripe,
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

    throw new Error(
      `Unsupported method "${method}" for provider "${PAYMENT_PROVIDER_IDS.stripe}".`,
    );
  }
}
