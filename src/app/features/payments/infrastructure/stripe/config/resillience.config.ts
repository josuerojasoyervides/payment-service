import type { ProviderResilienceConfig } from '@app/features/payments/application/api/contracts/resilience.types';

export const STRIPE_RESILIENCE_CONFIG: ProviderResilienceConfig = {
  circuitOpenCooldownMs: 30_000,
  rateLimitCooldownMs: 15_000,
};
