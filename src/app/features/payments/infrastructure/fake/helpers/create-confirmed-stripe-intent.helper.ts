import { StripePaymentIntentDto } from '@payments/infrastructure/stripe/dto/stripe.dto';

export function createConfirmedStripeIntent(intentId: string): StripePaymentIntentDto {
  return {
    id: intentId,
    object: 'payment_intent',
    amount: 10000,
    amount_received: 10000,
    currency: 'mxn',
    status: 'succeeded',
    client_secret: `${intentId}_secret_confirmed`,
    created: Math.floor(Date.now() / 1000) - 60,
    livemode: false,
    payment_method: 'pm_confirmed',
    payment_method_types: ['card'],
    capture_method: 'automatic',
    confirmation_method: 'automatic',
  };
}
