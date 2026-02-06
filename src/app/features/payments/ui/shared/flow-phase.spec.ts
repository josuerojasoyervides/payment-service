import { createMockPaymentState } from '@app/features/payments/application/api/testing/provide-mock-payment-state.harness';
import { INITIAL_FALLBACK_STATE } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-state.model';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import { INITIAL_RESILIENCE_STATE } from '@payments/application/orchestration/store/types/payment-store-state';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { deriveFlowPhase } from '@payments/ui/shared/flow-phase';

function setup(overrides: Parameters<typeof createMockPaymentState>[0] = {}) {
  const port = createMockPaymentState(overrides);
  const phaseSignal = deriveFlowPhase(port);
  return { phaseSignal, port };
}

describe('deriveFlowPhase', () => {
  it('returns editing when idle and no intent', () => {
    const { phaseSignal } = setup();
    expect(phaseSignal()).toBe('editing');
  });

  it('returns submitting when status is loading', () => {
    const { phaseSignal } = setup({ isLoading: true });
    expect(phaseSignal()).toBe('submitting');
  });

  it('returns action_required when intent has requires_action', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_1'),
      provider: 'stripe',
      status: 'requires_action',
      money: { amount: 100, currency: 'MXN' },
      clientSecret: 'secret',
      nextAction: { kind: 'client_confirm', token: 'tok_test' },
    };
    const { phaseSignal } = setup({ intent, isReady: true });
    expect(phaseSignal()).toBe('action_required');
  });

  it('returns processing when intent status is processing', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_1'),
      provider: 'stripe',
      status: 'processing',
      money: { amount: 100, currency: 'MXN' },
      clientSecret: 'secret',
    };
    const { phaseSignal } = setup({ intent, isReady: true });
    expect(phaseSignal()).toBe('processing');
  });

  it('returns done when intent status is succeeded', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_1'),
      provider: 'stripe',
      status: 'succeeded',
      money: { amount: 100, currency: 'MXN' },
      clientSecret: 'secret',
    };
    const { phaseSignal } = setup({ intent, isReady: true });
    expect(phaseSignal()).toBe('done');
  });

  it('returns done when status is ready (no intent)', () => {
    const { phaseSignal } = setup({ isReady: true });
    expect(phaseSignal()).toBe('done');
  });

  it('returns failed when status is error', () => {
    const { phaseSignal } = setup({ hasError: true });
    expect(phaseSignal()).toBe('failed');
  });

  it('returns failed when intent.status is failed even if hasError is false', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_1'),
      provider: 'stripe',
      status: 'failed',
      money: { amount: 100, currency: 'MXN' },
      clientSecret: 'secret',
    };
    const { phaseSignal } = setup({ intent, isReady: true, hasError: false });
    expect(phaseSignal()).toBe('failed');
  });

  it('returns fallback_pending when fallback is confirming', () => {
    const { phaseSignal } = setup({
      resilience: { ...INITIAL_RESILIENCE_STATE, status: 'fallback_confirming' },
    });
    expect(phaseSignal()).toBe('fallback_pending');
  });

  it('returns fallback_executing when fallback status is executing', () => {
    const { phaseSignal } = setup({
      fallback: { ...INITIAL_FALLBACK_STATE, status: 'executing' },
    });
    expect(phaseSignal()).toBe('fallback_executing');
  });

  it('returns fallback_executing when fallback status is auto_executing', () => {
    const { phaseSignal } = setup({
      fallback: { ...INITIAL_FALLBACK_STATE, status: 'auto_executing' },
    });
    expect(phaseSignal()).toBe('fallback_executing');
  });

  it('fallback_pending wins over hasError and requires_action', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_1'),
      provider: 'stripe',
      status: 'requires_action',
      money: { amount: 100, currency: 'MXN' },
      clientSecret: 'secret',
      nextAction: { kind: 'client_confirm', token: 'tok_test' },
    };
    const { phaseSignal } = setup({
      intent,
      hasError: true,
      isReady: true,
      resilience: { ...INITIAL_RESILIENCE_STATE, status: 'fallback_confirming' },
    });
    expect(phaseSignal()).toBe('fallback_pending');
  });
});
