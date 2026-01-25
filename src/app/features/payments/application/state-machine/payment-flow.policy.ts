import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

export function isFinalStatus(status?: string) {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

export function needsUserAction(intent?: PaymentIntent | null) {
  if (!intent) return false;
  return intent.status === 'requires_action' || !!intent.redirectUrl || !!intent.nextAction;
}
