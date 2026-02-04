import { InjectionToken } from '@angular/core';

import type { PaymentsInfraConfig } from './payments-infra-config.types';

export const PAYMENTS_INFRA_CONFIG = new InjectionToken<PaymentsInfraConfig>(
  'PAYMENTS_INFRA_CONFIG',
);
