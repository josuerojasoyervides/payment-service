import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

export function mapGeneric(dto: any, providerId: PaymentProviderId): PaymentIntent {
  return {
    id: toPaymentIntentIdOrThrow(dto.id ?? 'unknown'),
    provider: providerId,
    status: dto.status ?? 'processing',
    money: {
      amount: dto.amount ?? 0,
      currency: dto.currency ?? 'MXN',
    },
    raw: dto,
  };
}
