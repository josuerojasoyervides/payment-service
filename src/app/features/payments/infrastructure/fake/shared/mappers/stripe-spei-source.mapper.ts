import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { SPEI_RAW_KEYS } from '@payments/infrastructure/stripe/shared/constants/spei-raw-keys.constants';

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

export function mapStripeSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
  const spei = dto[SPEI_RAW_KEYS.SPEI];
  const speiBank = spei[SPEI_RAW_KEYS.BANK];
  const speiClabe = spei[SPEI_RAW_KEYS.CLABE];
  const speiReference = spei[SPEI_RAW_KEYS.REFERENCE];

  return {
    id: toPaymentIntentIdOrThrow(dto.id),
    provider: 'stripe',
    status: 'requires_action',
    money: {
      amount: dto.amount / 100,
      currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
    },
    nextAction: {
      kind: 'manual_step',
      details: {
        bankCode: speiBank?.trim() ?? '',
        clabe: speiClabe,
        beneficiaryName: 'Payment Service (Fake)',
        reference: speiReference,
        amount: dto.amount / 100,
        currency: dto.currency.toUpperCase(),
        expiresAt: new Date(dto.expires_at * 1000).toISOString(),
      },
    },
    raw: dto,
  };
}
