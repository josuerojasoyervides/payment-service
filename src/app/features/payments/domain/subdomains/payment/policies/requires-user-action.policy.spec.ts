import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { intentRequiresUserAction } from '@app/features/payments/domain/subdomains/payment/policies/requires-user-action.policy';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';

describe('intentRequiresUserAction', () => {
  const baseIntent: PaymentIntent = {
    id: createPaymentIntentId('pi_1'),
    provider: 'stripe',
    status: 'requires_payment_method',
    money: { amount: 100, currency: 'MXN' },
  };

  it('returns true when status is requires_action', () => {
    const intent: PaymentIntent = { ...baseIntent, status: 'requires_action' };
    expect(intentRequiresUserAction(intent)).toBe(true);
  });

  it('returns false when status is requires_payment_method', () => {
    expect(intentRequiresUserAction(baseIntent)).toBe(false);
  });

  it('returns false when status is succeeded', () => {
    const intent: PaymentIntent = { ...baseIntent, status: 'succeeded' };
    expect(intentRequiresUserAction(intent)).toBe(false);
  });

  it('returns false when status is processing', () => {
    const intent: PaymentIntent = { ...baseIntent, status: 'processing' };
    expect(intentRequiresUserAction(intent)).toBe(false);
  });

  it('returns false when status is failed', () => {
    const intent: PaymentIntent = { ...baseIntent, status: 'failed' };
    expect(intentRequiresUserAction(intent)).toBe(false);
  });
});
