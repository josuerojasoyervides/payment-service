import type { NextActionManualStep } from '@payments/domain/models/payment/payment-action.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { StripeSpeiSourceDto } from '@payments/infrastructure/stripe/dto/stripe.dto';
import { SpeiStatusMapper } from '@payments/infrastructure/stripe/methods/spei/mappers/spei-status.mapper';

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
      id: dto.id,
      provider: this.providerId,
      status,
      amount: dto.amount / 100,
      currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
      nextAction: speiAction,
      raw: dto,
    };
  }
}
