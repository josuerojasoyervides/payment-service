import { InjectionToken } from '@angular/core';
import { ProviderFactory } from '../domain/ports/provider-factory.port';

export const PAYMENT_PROVIDER_FACTORIES =
    new InjectionToken<ProviderFactory[]>('PAYMENT_PROVIDER_FACTORIES');
