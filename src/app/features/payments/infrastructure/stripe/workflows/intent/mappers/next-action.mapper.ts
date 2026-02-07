import type { NextAction } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { match, P } from 'ts-pattern';

export function mapStripeNextAction(dto: StripePaymentIntentDto): NextAction | undefined {
  return match(dto.next_action)
    .returnType<NextAction | undefined>()
    .with(
      {
        type: 'redirect_to_url',
        redirect_to_url: { url: P.string },
      },
      (action) => ({
        kind: 'redirect',
        url: action.redirect_to_url.url,
      }),
    )
    .with({ type: 'use_stripe_sdk' }, () => ({
      kind: 'client_confirm',
      token: dto.client_secret,
    }))
    .otherwise(() => undefined);
}
