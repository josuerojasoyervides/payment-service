import { NextAction } from '@payments/domain/models/payment/payment-action.types';

import { StripePaymentIntentDto } from '../dto/stripe.dto';

export function mapStripeNextAction(dto: StripePaymentIntentDto): NextAction | undefined {
  if (!dto.next_action) return undefined;

  if (dto.next_action.type === 'redirect_to_url' && dto.next_action.redirect_to_url) {
    return {
      kind: 'redirect',
      url: dto.next_action.redirect_to_url.url,
    };
  }

  if (dto.next_action.type === 'use_stripe_sdk') {
    return {
      kind: 'client_confirm',
      token: dto.client_secret,
    };
  }

  return undefined;
}
