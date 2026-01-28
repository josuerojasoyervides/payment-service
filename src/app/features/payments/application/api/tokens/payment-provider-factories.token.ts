import { InjectionToken } from '@angular/core';

import type { ProviderFactory } from '../ports/provider-factory.port';

export const PAYMENT_PROVIDER_FACTORIES = new InjectionToken<ProviderFactory[]>(
  'PAYMENT_PROVIDER_FACTORIES',
);
