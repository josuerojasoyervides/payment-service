import type { Provider } from '@angular/core';

import { PAYMENTS_INFRA_CONFIG } from './payments-infra-config.token';
import type {
  PaymentsInfraConfig,
  PaymentsInfraConfigInput,
  PaypalAppContextDefaults,
  PaypalLandingPage,
  PaypalUserAction,
} from './payments-infra-config.types';

const PAYPAL_LANDING_PAGES: readonly PaypalLandingPage[] = ['LOGIN', 'BILLING', 'NO_PREFERENCE'];
const PAYPAL_USER_ACTIONS: readonly PaypalUserAction[] = ['PAY_NOW', 'CONTINUE'];

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function assertNonEmptyString(value: string | undefined, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[PaymentsInfraConfig] ${field} must be a non-empty string`);
  }
  return value.trim();
}

function assertPositiveNumber(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`[PaymentsInfraConfig] ${field} must be a positive number`);
  }
}

function validatePaypalDefaults(defaults: PaypalAppContextDefaults): void {
  assertNonEmptyString(defaults.brand_name, 'paypal.defaults.brand_name');
  if (!PAYPAL_LANDING_PAGES.includes(defaults.landing_page)) {
    throw new Error('[PaymentsInfraConfig] paypal.defaults.landing_page is invalid');
  }
  if (!PAYPAL_USER_ACTIONS.includes(defaults.user_action)) {
    throw new Error('[PaymentsInfraConfig] paypal.defaults.user_action is invalid');
  }
}

function validateSpeiDisplayConfig(
  displayConfig: PaymentsInfraConfigInput['spei']['displayConfig'],
): void {
  const banks = displayConfig.receivingBanks;
  if (Object.keys(banks).length === 0) {
    throw new Error('[PaymentsInfraConfig] spei.displayConfig.receivingBanks must be non-empty');
  }
  for (const [code, name] of Object.entries(banks)) {
    if (!code.trim() || !name.trim()) {
      throw new Error(
        '[PaymentsInfraConfig] spei.displayConfig.receivingBanks entries must be non-empty',
      );
    }
  }
  assertNonEmptyString(displayConfig.beneficiaryName, 'spei.displayConfig.beneficiaryName');
}

function validatePaymentsInfraConfig(input: PaymentsInfraConfigInput): void {
  assertNonEmptyString(input.paymentsBackendBaseUrl, 'paymentsBackendBaseUrl');
  assertPositiveNumber(input.timeouts.stripeMs, 'timeouts.stripeMs');
  assertPositiveNumber(input.timeouts.paypalMs, 'timeouts.paypalMs');
  validatePaypalDefaults(input.paypal.defaults);
  validateSpeiDisplayConfig(input.spei.displayConfig);
}

export function buildPaymentsInfraConfig(input: PaymentsInfraConfigInput): PaymentsInfraConfig {
  validatePaymentsInfraConfig(input);

  const paymentsBackendBaseUrl = normalizeBaseUrl(input.paymentsBackendBaseUrl);

  return {
    paymentsBackendBaseUrl,
    stripe: {
      baseUrl: `${paymentsBackendBaseUrl}/stripe`,
      timeoutMs: input.timeouts.stripeMs,
    },
    paypal: {
      baseUrl: `${paymentsBackendBaseUrl}/paypal`,
      timeoutMs: input.timeouts.paypalMs,
      defaults: input.paypal.defaults,
    },
    spei: {
      displayConfig: input.spei.displayConfig,
    },
  };
}

export function providePaymentsInfraConfig(input: PaymentsInfraConfigInput): Provider {
  return {
    provide: PAYMENTS_INFRA_CONFIG,
    useValue: buildPaymentsInfraConfig(input),
  };
}
