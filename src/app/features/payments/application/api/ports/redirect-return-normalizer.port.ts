import type { RedirectReturnRaw } from '@app/features/payments/application/api/contracts/redirect-return.contract';
import type { RedirectReturnedPayload } from '@app/features/payments/application/api/contracts/redirect-return-normalized.contract';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

export interface RedirectReturnNormalizerPort {
  readonly providerId: PaymentProviderId;
  normalize(raw: RedirectReturnRaw): RedirectReturnedPayload | null;
}
