import type { Provider } from '@angular/core';
import { match } from 'ts-pattern';

import { PAYMENTS_INFRA_CONFIG } from './payments-infra-config.token';
import type { PaymentsInfraConfig, PaymentsInfraConfigInput } from './payments-infra-config.types';
import { PaymentsInfraConfigInputSchema } from './payments-infra-config.types';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function validatePaymentsInfraConfig(input: PaymentsInfraConfigInput): void {
  const parsed = PaymentsInfraConfigInputSchema.safeParse(input);
  if (parsed.success) return;

  const issuePath = parsed.error.issues[0]?.path?.join('.') ?? 'unknown';

  match(issuePath)
    .with('paymentsBackendBaseUrl', () => {
      throw new Error('[PaymentsInfraConfig] paymentsBackendBaseUrl must be a non-empty string');
    })
    .with('timeouts.stripeMs', () => {
      throw new Error('[PaymentsInfraConfig] timeouts.stripeMs must be a positive number');
    })
    .with('timeouts.paypalMs', () => {
      throw new Error('[PaymentsInfraConfig] timeouts.paypalMs must be a positive number');
    })
    .with('paypal.defaults.brand_name', () => {
      throw new Error(
        '[PaymentsInfraConfig] paypal.defaults.brand_name must be a non-empty string',
      );
    })
    .with('paypal.defaults.landing_page', () => {
      throw new Error('[PaymentsInfraConfig] paypal.defaults.landing_page is invalid');
    })
    .with('paypal.defaults.user_action', () => {
      throw new Error('[PaymentsInfraConfig] paypal.defaults.user_action is invalid');
    })
    .with('spei.displayConfig.receivingBanks', 'receivingBanks', () => {
      throw new Error('[PaymentsInfraConfig] spei.displayConfig.receivingBanks must be non-empty');
    })
    .with('spei.displayConfig.beneficiaryName', 'beneficiaryName', () => {
      throw new Error('[PaymentsInfraConfig] spei.displayConfig.beneficiaryName must be non-empty');
    })
    .otherwise(() => {
      throw new Error('[PaymentsInfraConfig] invalid config');
    });
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
