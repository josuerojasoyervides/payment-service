import type { StripePaymentIntentDto } from '@payments/infrastructure/stripe/dto/stripe.dto';

import { hashString } from './hash-string.helper';

export function createFakeStripeIntentStatus(intentId: string): StripePaymentIntentDto {
  // Deterministic status based on intentId hash
  // This ensures the same intentId always returns the same status
  const hash = hashString(intentId);
  const statuses: StripePaymentIntentDto['status'][] = [
    'requires_confirmation',
    'processing',
    'succeeded',
  ];
  const statusIndex = hash % statuses.length;
  const status = statuses[statusIndex];

  return {
    id: intentId,
    object: 'payment_intent',
    amount: 10000,
    amount_received: status === 'succeeded' ? 10000 : 0,
    currency: 'mxn',
    status,
    client_secret: `${intentId}_secret_status`,
    created: Math.floor(Date.now() / 1000) - 120,
    livemode: false,
    payment_method: 'pm_existing',
    payment_method_types: ['card'],
    capture_method: 'automatic',
    confirmation_method: 'automatic',
  };
}
