import { InjectionToken } from '@angular/core';

import type { ProviderMethodPolicyPort } from '../ports/provider-method-policy.port';

export const PAYMENT_PROVIDER_METHOD_POLICIES = new InjectionToken<ProviderMethodPolicyPort[]>(
  'PAYMENT_PROVIDER_METHOD_POLICIES',
);
