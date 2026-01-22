import { NextActionThreeDs } from '@payments/domain/models';
import { StripePaymentIntentDto } from '../dto/stripe.dto';

export function mapStripeNextAction(dto: StripePaymentIntentDto): NextActionThreeDs | undefined {
  if (!dto.next_action) return undefined;

  if (dto.next_action.type === 'redirect_to_url' && dto.next_action.redirect_to_url) {
    return {
      type: '3ds',
      clientSecret: dto.client_secret,
      returnUrl: dto.next_action.redirect_to_url.return_url,
      threeDsVersion: '2.0',
    };
  }

  if (dto.next_action.type === 'use_stripe_sdk') {
    return {
      type: '3ds',
      clientSecret: dto.client_secret,
      returnUrl: '',
      threeDsVersion: '2.0',
    };
  }

  return undefined;
}
