import type {
  PaymentIntent,
  PaymentProviderId,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';

export function mapGeneric(dto: any, providerId: PaymentProviderId): PaymentIntent {
  return {
    id: dto.id ?? 'unknown',
    provider: providerId,
    status: dto.status ?? 'processing',
    amount: dto.amount ?? 0,
    currency: dto.currency ?? 'MXN',
    raw: dto,
  };
}
