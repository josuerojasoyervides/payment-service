import {
  createFlowContext,
  FLOW_CONTEXT_TTL_MS,
  mergeProviderRefs,
  updateFlowContextProviderRefs,
} from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import type { PaymentFlowContext } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.types';

describe('payment-flow.context', () => {
  const request: CreatePaymentRequest = {
    orderId: 'order_123',
    amount: 100,
    currency: 'MXN',
    method: { type: 'card', token: 'tok_123' },
  };

  it('creates a deterministic flow context with ids and timestamps', () => {
    const nowMs = 1_700_000_000_000;
    const flowIdGenerator = () => 'flow_stub';
    const result = createFlowContext({
      providerId: 'stripe',
      request,
      nowMs,
      flowIdGenerator,
    });

    expect(result.flowId).toBe('flow_stub');
    expect(result.providerId).toBe('stripe');
    expect(result.externalReference).toBe('order_123');
    expect(result.createdAt).toBe(nowMs);
    expect(result.expiresAt).toBe(nowMs + FLOW_CONTEXT_TTL_MS);
    expect(result.providerRefs?.stripe).toBeDefined();
  });

  it('preserves existing context fields when present', () => {
    const existing: PaymentFlowContext = {
      flowId: 'flow_existing',
      providerId: 'paypal',
      externalReference: 'external_1',
      createdAt: 10,
      expiresAt: 20,
      providerRefs: { paypal: { orderId: 'order_legacy' } },
    };

    const result = createFlowContext({
      providerId: 'stripe',
      request,
      existing,
      nowMs: 100,
    });

    expect(result.flowId).toBe('flow_existing');
    expect(result.providerId).toBe('stripe');
    expect(result.externalReference).toBe('external_1');
    expect(result.createdAt).toBe(10);
    expect(result.expiresAt).toBe(20);
    expect(result.providerRefs?.paypal?.orderId).toBe('order_legacy');
  });

  it('merges provider references without overwriting defined values', () => {
    const merged = mergeProviderRefs(
      { stripe: { intentId: 'pi_1' }, paypal: { orderId: 'order_1' } },
      { stripe: { orderId: 'order_2', intentId: undefined }, paypal: { paymentId: 'pay_1' } },
    );

    expect(merged.stripe?.intentId).toBe('pi_1');
    expect(merged.stripe?.orderId).toBe('order_2');
    expect(merged.paypal?.orderId).toBe('order_1');
    expect(merged.paypal?.paymentId).toBe('pay_1');
  });

  it('updates flow context provider refs when present', () => {
    const context: PaymentFlowContext = {
      flowId: 'flow_1',
      providerId: 'stripe',
      providerRefs: { stripe: { intentId: 'pi_old' } },
    };

    const updated = updateFlowContextProviderRefs({
      context,
      providerId: 'stripe',
      refs: { orderId: 'order_new' },
    });

    expect(updated?.providerRefs?.stripe?.intentId).toBe('pi_old');
    expect(updated?.providerRefs?.stripe?.orderId).toBe('order_new');
  });
});
