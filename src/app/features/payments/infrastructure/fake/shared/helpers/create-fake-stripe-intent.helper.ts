// ============ FAKE STRIPE RESPONSES ============

import { SPECIAL_TOKENS } from '@app/features/payments/infrastructure/fake/shared/constants/special-tokens';
import { generateId } from '@app/features/payments/infrastructure/fake/shared/helpers/get-id.helper';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

export function createFakeStripeIntent(
  req: CreatePaymentRequest,
  forcedStatus?: StripePaymentIntentDto['status'],
): StripePaymentIntentDto {
  const intentId = generateId('pi');
  const amountInCents = Math.round(req.amount * 100);

  let status: StripePaymentIntentDto['status'];

  if (forcedStatus !== undefined) {
    status = forcedStatus;
  } else {
    // Deterministic behavior: default to requires_confirmation
    // Only change to requires_action if token explicitly indicates 3DS
    status = 'requires_confirmation';

    // Check token for explicit 3DS indicators (deterministic)
    const token = req.method.token ?? '';
    const requires3ds =
      token.includes('3ds') || token.includes('auth') || token.startsWith(SPECIAL_TOKENS.THREE_DS);

    if (requires3ds) {
      status = 'requires_action';
    }
  }

  return {
    id: intentId,
    object: 'payment_intent',
    amount: amountInCents,
    amount_received: status === 'succeeded' ? amountInCents : 0,
    currency: req.currency.toLowerCase(),
    status,
    client_secret: `${intentId}_secret_${generateId('sec')}`,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    metadata: {
      order_id: req.orderId,
    },
    payment_method: req.method.token ?? null,
    payment_method_types: ['card'],
    capture_method: 'automatic',
    confirmation_method: 'automatic',
    next_action:
      status === 'requires_action'
        ? {
            type: 'redirect_to_url',
            redirect_to_url: {
              url: `https://hooks.stripe.com/3d_secure_2/authenticate/${intentId}`,
              return_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/payments/return`,
            },
          }
        : null,
  };
}
