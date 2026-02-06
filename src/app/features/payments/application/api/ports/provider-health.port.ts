import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
}

/**
 * Port for checking provider health.
 */
export interface ProviderHealthPort {
  check(providerId: PaymentProviderId): Promise<HealthStatus>;
}
