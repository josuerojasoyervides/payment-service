import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { NextActionManualStep } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { SpeiStatusMapper } from '@payments/infrastructure/stripe/payment-methods/spei/mappers/spei-status.mapper';

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

export class SpeiSourceMapper {
  constructor(private readonly providerId: PaymentProviderId) {}

  mapSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
    const speiAction: NextActionManualStep = {
      kind: 'manual_step',
      instructions: ['Make a bank transfer using the details below.'],
      details: [
        { label: 'CLABE', value: dto.spei.clabe },
        { label: 'Reference', value: dto.spei.reference },
        { label: 'Bank', value: dto.spei.bank },
        { label: 'Beneficiary', value: 'Stripe Payments Mexico' },
        { label: 'Amount', value: `${dto.amount / 100} ${dto.currency.toUpperCase()}` },
        { label: 'Expires At', value: new Date(dto.expires_at * 1000).toISOString() },
      ],
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
