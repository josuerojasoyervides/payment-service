import { InjectionToken } from '@angular/core';
import type { ExternalNavigatorPort } from '@payments/application/api/ports/external-navigator.port';

export const EXTERNAL_NAVIGATOR = new InjectionToken<ExternalNavigatorPort>('EXTERNAL_NAVIGATOR');
