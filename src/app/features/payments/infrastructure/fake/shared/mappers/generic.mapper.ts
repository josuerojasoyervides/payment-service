import type {
  PaymentIntent,
  PaymentIntentStatus,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import {
  CURRENCY_CODES,
  type CurrencyCode,
} from '@payments/domain/common/primitives/money/currency.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && CURRENCY_CODES.includes(value as CurrencyCode);
}

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

export function mapGeneric(dto: unknown, providerId: PaymentProviderId): PaymentIntent {
  const record = isRecord(dto) ? dto : {};
  const status =
    typeof record['status'] === 'string' ? (record['status'] as PaymentIntentStatus) : 'processing';
  const amount = typeof record['amount'] === 'number' ? record['amount'] : 0;
  const currency = isCurrencyCode(record['currency']) ? record['currency'] : 'MXN';
  const rawId = typeof record['id'] === 'string' ? record['id'] : 'unknown';

  return {
    id: toPaymentIntentIdOrThrow(rawId),
    provider: providerId,
    status,
    money: {
      amount,
      currency,
    },
    raw: dto,
  };
}
