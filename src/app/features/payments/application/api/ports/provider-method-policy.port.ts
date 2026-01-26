import {
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

export interface ProviderMethodPolicy {
  providerId: PaymentProviderId;
  method: PaymentMethodType;
  requires: {
    token?: boolean;
    returnUrl?: boolean;
    cancelUrl?: boolean;
  };
  flow: {
    usesRedirect: boolean;
    requiresUserAction: boolean;
    supportsPolling: boolean;
  };
  stages: {
    authorize: boolean;
    capture: boolean;
    settle: boolean;
  };
}

export interface ProviderMethodPolicyPort {
  readonly providerId: PaymentProviderId;
  getPolicy(method: PaymentMethodType): ProviderMethodPolicy;
}
