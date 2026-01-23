import { I18nKeys } from '@core/i18n';
import { NextActionSpei, PaymentIntent, PaymentProviderId } from '@payments/domain/models';

import { StripeSpeiSourceDto } from '../dto/stripe.dto';
import { SpeiStatusMapper } from './spei-status.mapper';

export class SpeiSourceMapper {
  constructor(private readonly providerId: PaymentProviderId) {}

  mapSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
    const speiAction: NextActionSpei = {
      type: 'spei',
      clabe: dto.spei.clabe,
      reference: dto.spei.reference,
      bank: dto.spei.bank,
      amount: dto.amount / 100,
      currency: dto.currency.toUpperCase(),
      expiresAt: new Date(dto.expires_at * 1000).toISOString(),

      instructions: I18nKeys.messages.spei_instructions,
      beneficiary: I18nKeys.ui.stripe_beneficiary,
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
