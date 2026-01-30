// ============ FAKE STRIPE RESPONSES ============

import { SPECIAL_TOKENS } from '@app/features/payments/infrastructure/fake/shared/constants/special-tokens';
import { generateId } from '@app/features/payments/infrastructure/fake/shared/helpers/get-id.helper';
import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

export type FakeNextActionKind = 'redirect' | 'client_confirm';

export function createFakeStripeIntent(
  req: CreatePaymentRequest,
  forcedStatus?: StripePaymentIntentDto['status'],
  nextActionKind?: FakeNextActionKind,
): StripePaymentIntentDto {
  const intentId = generateId('pi');
  const amountInCents = Math.round(req.amount * 100);
  const clientSecret = `${intentId}_secret_${generateId('sec')}`;

  let status: StripePaymentIntentDto['status'];

  if (forcedStatus !== undefined) {
    status = forcedStatus;
  } else {
    status = 'requires_confirmation';
    const token = req.method.token ?? '';
    const requires3ds =
      token.includes('3ds') || token.includes('auth') || token.startsWith(SPECIAL_TOKENS.THREE_DS);
    const requiresClientConfirm = token.startsWith(SPECIAL_TOKENS.CLIENT_CONFIRM);
    if (requires3ds || requiresClientConfirm) {
      status = 'requires_action';
    }
  }

  let next_action: StripePaymentIntentDto['next_action'] = null;
  if (status === 'requires_action') {
    const kind = nextActionKind ?? 'redirect';
    if (kind === 'client_confirm') {
      next_action = { type: 'use_stripe_sdk' };
    } else {
      next_action = {
        type: 'redirect_to_url',
        redirect_to_url: {
          url: `https://hooks.stripe.com/3d_secure_2/authenticate/${intentId}`,
          return_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/payments/return`,
        },
      };
    }
  }

  return {
    id: intentId,
    object: 'payment_intent',
    amount: amountInCents,
    amount_received: status === 'succeeded' ? amountInCents : 0,
    currency: req.currency.toLowerCase(),
    status,
    client_secret: clientSecret,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    metadata: {
      order_id: req.orderId,
    },
    payment_method: req.method.token ?? null,
    payment_method_types: ['card'],
    capture_method: 'automatic',
    confirmation_method: 'automatic',
    next_action,
  };
}
