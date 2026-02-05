import { InjectionToken } from '@angular/core';
import type { SpeiDisplayConfig } from '@payments/application/api/contracts/spei-display-config.types';

export const SPEI_DISPLAY_CONFIG = new InjectionToken<SpeiDisplayConfig>('SPEI_DISPLAY_CONFIG');
