import type { FallbackConfig } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-config.model';
import { KNOWN_PROVIDER_IDS } from '@payments/application/api/contracts/payment-provider-catalog.types';

/**
 * Default fallback configuration (operational concern).
 * Lives in Application — not Domain — because provider priority and defaults
 * are deployment/config concerns.
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: true,
  maxAttempts: 2,
  userResponseTimeout: 30000,
  triggerErrorCodes: ['provider_unavailable', 'provider_error', 'network_error', 'timeout'],
  providerPriority: [...KNOWN_PROVIDER_IDS],
  mode: 'manual',
  autoFallbackDelay: 2000,
  maxAutoFallbacks: 1,
};
