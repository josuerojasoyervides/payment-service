import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { NextActionManualStep } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { SPEI_RAW_KEYS } from '@app/features/payments/infrastructure/stripe/shared/constants/raw-keys.constants';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { SpeiStatusMapper } from '@payments/infrastructure/stripe/payment-methods/spei/mappers/spei-status.mapper';

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

export class SpeiSourceMapper {
  constructor(
    private readonly providerId: PaymentProviderId,
    private readonly beneficiaryName: string,
  ) {}

  mapSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
    const spei = dto[SPEI_RAW_KEYS.SPEI];
    const speiBank = spei[SPEI_RAW_KEYS.BANK];
    const speiClabe = spei[SPEI_RAW_KEYS.CLABE];
    const speiReference = spei[SPEI_RAW_KEYS.REFERENCE];

    const speiAction: NextActionManualStep = {
      kind: 'manual_step',
      details: {
        bankCode: speiBank?.trim() ?? '',
        clabe: speiClabe,
        beneficiaryName: this.beneficiaryName,
        reference: speiReference,
        amount: dto.amount / 100,
        currency: dto.currency.toUpperCase(),
        expiresAt: new Date(dto.expires_at * 1000).toISOString(),
      },
    };

    const status = new SpeiStatusMapper().mapSpeiStatus(dto.status);

    return {
      id: toPaymentIntentIdOrThrow(dto.id),
      provider: this.providerId,
      status,
      money: {
        amount: dto.amount / 100,
        currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
      },
      nextAction: speiAction,
      raw: dto,
    };
  }
}
