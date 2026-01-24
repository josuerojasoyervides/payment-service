import { I18nKeys } from '@core/i18n';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { StripeSpeiSourceDto } from '@payments/infrastructure/stripe/dto/stripe.dto';

export function mapStripeSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
  return {
    id: dto.id,
    provider: 'stripe',
    status: 'requires_action',
    amount: dto.amount / 100,
    currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
    nextAction: {
      type: 'spei',
      instructions: I18nKeys.ui.spei_instructions,
      clabe: dto.spei.clabe,
      reference: dto.spei.reference,
      bank: dto.spei.bank,
      beneficiary: 'Payment Service (Fake)',
      amount: dto.amount / 100,
      currency: dto.currency.toUpperCase(),
      expiresAt: new Date(dto.expires_at * 1000).toISOString(),
    },
    raw: dto,
  };
}
