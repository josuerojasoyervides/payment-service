import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  ProviderMethodPolicy,
  ProviderMethodPolicyPort,
} from '@payments/application/api/ports/provider-method-policy.port';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

export class PaypalProviderMethodPolicy implements ProviderMethodPolicyPort {
  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.paypal;

  getPolicy(method: PaymentMethodType): ProviderMethodPolicy {
    if (method === 'card') {
      return {
        providerId: PAYMENT_PROVIDER_IDS.paypal,
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

    throw new Error(
      `Unsupported method "${method}" for provider "${PAYMENT_PROVIDER_IDS.paypal}".`,
    );
  }
}
