import { InjectionToken } from '@angular/core';

import type { PaymentFlowMachineContext } from './deps/payment-flow.types';
import type { PaymentFlowConfigOverrides } from './policy/payment-flow.policy';

/**
 * Optional config overrides for the payment flow machine (e.g. in tests for short timeouts).
 */
export const PAYMENT_FLOW_CONFIG_OVERRIDES = new InjectionToken<PaymentFlowConfigOverrides>(
  'PAYMENT_FLOW_CONFIG_OVERRIDES',
);

/**
 * Optional initial context override for the payment flow machine (tests only).
 */
export const PAYMENT_FLOW_INITIAL_CONTEXT = new InjectionToken<Partial<PaymentFlowMachineContext>>(
  'PAYMENT_FLOW_INITIAL_CONTEXT',
);
