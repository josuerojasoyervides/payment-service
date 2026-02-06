import { InjectionToken } from '@angular/core';
import type { ProviderHealthPort } from '@app/features/payments/application/api/ports/provider-health.port';

export const PROVIDER_HEALTH_PORT = new InjectionToken<ProviderHealthPort>('PROVIDER_HEALTH_PORT');
