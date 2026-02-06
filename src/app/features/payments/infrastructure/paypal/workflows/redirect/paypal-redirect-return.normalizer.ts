import type { RedirectReturnRaw } from '@app/features/payments/application/api/contracts/redirect-return.contract';
import type { RedirectReturnedPayload } from '@app/features/payments/application/api/contracts/redirect-return-normalized.contract';
import type { RedirectReturnNormalizerPort } from '@app/features/payments/application/api/ports/redirect-return-normalizer.port';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

export class PaypalRedirectReturnNormalizer implements RedirectReturnNormalizerPort {
  readonly providerId: PaymentProviderId = PAYMENT_PROVIDER_IDS.paypal;

  normalize(raw: RedirectReturnRaw): RedirectReturnedPayload | null {
    const query = raw?.query;
    if (!query) return null;

    const referenceId = readLast(query, 'token');
    if (!referenceId) return null;

    return {
      providerId: PAYMENT_PROVIDER_IDS.paypal,
      referenceId,
    };
  }
}

function readLast(query: Record<string, string | string[]>, key: string): string | null {
  const value = query[key];
  if (value == null) return null;
  if (Array.isArray(value)) {
    if (!value.length) return null;
    const last = value[value.length - 1];
    return typeof last === 'string' && last ? last : null;
  }
  return typeof value === 'string' && value ? value : null;
}
