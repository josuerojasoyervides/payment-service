import { InjectionToken } from '@angular/core';
import type { ProviderFactory } from '@payments/application/api/ports/provider-factory.port';

export const PAYMENT_PROVIDER_FACTORIES = new InjectionToken<ProviderFactory[]>(
  'PAYMENT_PROVIDER_FACTORIES',
);
