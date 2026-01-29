import { InjectionToken } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { WebhookNormalizer } from '@payments/domain/subdomains/payment/ports/payment-webhook-normalizer.port';

export type WebhookNormalizerRegistry = Partial<
  Record<PaymentProviderId, WebhookNormalizer<unknown, unknown>>
>;

export const WEBHOOK_NORMALIZER_REGISTRY = new InjectionToken<WebhookNormalizerRegistry>(
  'WEBHOOK_NORMALIZER_REGISTRY',
  {
    factory: () => ({}),
  },
);
