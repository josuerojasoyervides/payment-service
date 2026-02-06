import type { FallbackConfig } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-config.model';
import { KNOWN_PROVIDER_IDS } from '@payments/application/api/contracts/payment-provider-catalog.types';

function resolveResilienceEnabled(): boolean {
  const raw = (globalThis as { PAYMENTS_RESILIENCE_ENABLED?: string | boolean | number | null })
    .PAYMENTS_RESILIENCE_ENABLED;
  if (raw === undefined || raw === null) return true;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return raw !== 0;
  if (typeof raw === 'string') return raw.toLowerCase() !== 'false';
  return true;
}

/**
 * Default fallback configuration (operational concern).
 * Lives in Application — not Domain — because provider priority and defaults
 * are deployment/config concerns.
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: resolveResilienceEnabled(),
  maxAttempts: 2,
  userResponseTimeout: 30000,
  triggerErrorCodes: ['provider_unavailable', 'network_error', 'timeout'],
  blockedErrorCodes: ['card_declined'],
  providerPriority: [...KNOWN_PROVIDER_IDS],
  mode: 'manual',
  autoFallbackDelay: 2000,
  maxAutoFallbacks: 1,
};
