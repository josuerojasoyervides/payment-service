import { Injectable } from '@angular/core';
import type {
  HealthStatus,
  ProviderHealthPort,
} from '@app/features/payments/application/api/ports/provider-health.port';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

const DEFAULT_DELAY_MS = 250;

@Injectable()
export class MockProviderHealthAdapter implements ProviderHealthPort {
  async check(providerId: PaymentProviderId): Promise<HealthStatus> {
    const startedAt = Date.now();
    const delayMs = providerId === 'paypal' ? 400 : DEFAULT_DELAY_MS;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const status: HealthStatus['status'] =
      providerId === 'paypal' ? 'degraded' : providerId === 'stripe' ? 'healthy' : 'down';

    return {
      status,
      latencyMs: Date.now() - startedAt,
    };
  }
}
