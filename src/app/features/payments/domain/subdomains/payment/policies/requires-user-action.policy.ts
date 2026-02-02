import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';

/**
 * Pure domain policy: whether an intent is in a state that requires user action.
 *
 * Strategies can use this as a base and add method-specific conditions
 * (e.g. nextAction.kind === 'client_confirm' for 3DS, 'manual_step' for SPEI).
 */
export function intentRequiresUserAction(intent: PaymentIntent): boolean {
  return intent.status === 'requires_action';
}
