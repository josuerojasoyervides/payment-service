import { FallbackConfig } from '@payments/domain/models/fallback/fallback-config.types';
import { FallbackState } from '@payments/domain/models/fallback/fallback-state.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

import { ProviderFactoryRegistry } from '../../registry/provider-factory.registry';

export function isEligibleForFallbackPolicy(config: FallbackConfig, error: PaymentError): boolean {
  return config.triggerErrorCodes.includes(error.code);
}

export function getAutoFallbackCountPolicy(state: FallbackState): number {
  return state.failedAttempts.filter((a) => a.wasAutoFallback).length;
}

export function canAutoFallbackPolicy(config: FallbackConfig, state: FallbackState): boolean {
  return getAutoFallbackCountPolicy(state) < config.maxAutoFallbacks;
}

export function shouldAutoFallbackPolicy(config: FallbackConfig, state: FallbackState): boolean {
  return config.mode === 'auto' && canAutoFallbackPolicy(config, state);
}

export function getAlternativeProvidersPolicy(
  registry: ProviderFactoryRegistry,
  config: FallbackConfig,
  state: FallbackState,
  failedProvider: PaymentProviderId,
  request: CreatePaymentRequest,
): PaymentProviderId[] {
  const allProviders = registry.getAvailableProviders();
  const failedProviderIds = state.failedAttempts.map((a) => a.provider);

  const priority = Array.from(new Set([...config.providerPriority, ...allProviders]));

  return priority
    .filter(
      (provider) =>
        provider !== failedProvider &&
        !failedProviderIds.includes(provider) &&
        allProviders.includes(provider),
    )
    .filter((provider) => {
      try {
        const factory = registry.get(provider);
        return factory.supportsMethod(request.method.type);
      } catch {
        return false;
      }
    });
}

export function generateEventIdPolicy(): string {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
