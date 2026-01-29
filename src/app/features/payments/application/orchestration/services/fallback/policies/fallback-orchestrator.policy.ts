import type { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import type { FallbackConfig } from '@payments/domain/subdomains/fallback/contracts/fallback-config.types';
import type { FallbackState } from '@payments/domain/subdomains/fallback/contracts/fallback-state.types';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

/**
 * ✅ Eligibility / stopping conditions
 */
export function isEligibleForFallbackPolicy(config: FallbackConfig, error: PaymentError): boolean {
  return config.triggerErrorCodes.includes(error.code);
}

export function hasReachedMaxAttemptsPolicy(config: FallbackConfig, state: FallbackState): boolean {
  return state.failedAttempts.length >= config.maxAttempts;
}

/**
 * ✅ Auto-fallback decision chain
 */
export function getAutoFallbackCountPolicy(state: FallbackState): number {
  return state.failedAttempts.filter((a) => a.wasAutoFallback).length;
}

export function canAutoFallbackPolicy(config: FallbackConfig, state: FallbackState): boolean {
  return getAutoFallbackCountPolicy(state) < config.maxAutoFallbacks;
}

export function shouldAutoFallbackPolicy(config: FallbackConfig, state: FallbackState): boolean {
  return config.mode === 'auto' && canAutoFallbackPolicy(config, state);
}

/**
 * ✅ Alternative provider selection
 */
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

/**
 * ✅ Utility
 */
export function generateEventIdPolicy(): string {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
