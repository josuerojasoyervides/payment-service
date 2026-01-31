import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';

export function mapStripeSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
  return {
    id: dto.id,
    provider: 'stripe',
    status: 'requires_action',
    amount: dto.amount / 100,
    currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
    nextAction: {
      kind: 'manual_step',
      instructions: ['Make a bank transfer using the details below.'],
      details: [
        { label: 'CLABE', value: dto.spei.clabe },
        { label: 'Reference', value: dto.spei.reference },
        { label: 'Bank', value: dto.spei.bank },
        { label: 'Beneficiary', value: 'Payment Service (Fake)' },
        { label: 'Amount', value: `${dto.amount / 100} ${dto.currency.toUpperCase()}` },
        { label: 'Expires At', value: new Date(dto.expires_at * 1000).toISOString() },
      ],
    },
    raw: dto,
  };
}
