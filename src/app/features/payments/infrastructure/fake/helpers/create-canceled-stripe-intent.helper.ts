import { StripePaymentIntentDto } from '@payments/infrastructure/stripe/dto/stripe.dto';

export function createCanceledStripeIntent(intentId: string): StripePaymentIntentDto {
  return {
    id: intentId,
    object: 'payment_intent',
    amount: 10000,
    amount_received: 0,
    currency: 'mxn',
    status: 'canceled',
    client_secret: `${intentId}_secret_canceled`,
    created: Math.floor(Date.now() / 1000) - 60,
    livemode: false,
    payment_method: null,
    payment_method_types: ['card'],
    capture_method: 'automatic',
    confirmation_method: 'automatic',
  };
}
