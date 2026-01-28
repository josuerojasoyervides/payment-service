import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';

import { FLOW_CONTEXT_TTL_MS } from './payment-flow.context';
import {
  FLOW_CONTEXT_SCHEMA_VERSION,
  FlowContextStore,
  KeyValueStorage,
} from './payment-flow.persistence';

class MemoryStorage implements KeyValueStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('FlowContextStore', () => {
  it('persists only allowlisted context fields', () => {
    const storage = new MemoryStorage();
    const store = new FlowContextStore(storage, { now: () => 1000 });

    const context: PaymentFlowContext = {
      flowId: 'flow_1',
      providerId: 'stripe',
      externalReference: 'order_1',
      providerRefs: { stripe: { intentId: 'pi_1' } },
      createdAt: 500,
      expiresAt: 2000,
      lastExternalEventId: 'evt_1',
      lastReturnNonce: 'nonce_1',
      returnParamsSanitized: { result: 'ok' },
      returnUrl: 'https://return.test',
      cancelUrl: 'https://cancel.test',
      isTest: true,
      deviceData: { ipAddress: '127.0.0.1' },
      metadata: { clientSecret: 'secret' },
    };

    const persisted = store.save(context);
    expect(persisted).toBeTruthy();

    const raw = storage.getItem('payment_flow_context_v1');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.schemaVersion).toBe(FLOW_CONTEXT_SCHEMA_VERSION);
    expect(parsed.deviceData).toBeUndefined();
    expect(parsed.metadata).toBeUndefined();
    expect(parsed.flowId).toBe('flow_1');
    expect(parsed.providerRefs?.stripe?.intentId).toBe('pi_1');
  });

  it('expires persisted context by TTL', () => {
    const storage = new MemoryStorage();
    const now = 10_000;
    const store = new FlowContextStore(storage, { now: () => now });

    store.save({ flowId: 'flow_1', createdAt: now });

    const expiredStore = new FlowContextStore(storage, {
      now: () => now + FLOW_CONTEXT_TTL_MS + 1,
    });
    const loaded = expiredStore.load();

    expect(loaded).toBeNull();
    expect(storage.getItem('payment_flow_context_v1')).toBeNull();
  });

  it('clears persisted context on schema version mismatch', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'payment_flow_context_v1',
      JSON.stringify({
        schemaVersion: FLOW_CONTEXT_SCHEMA_VERSION + 1,
        flowId: 'flow_1',
        persistedAt: 1000,
      }),
    );

    const store = new FlowContextStore(storage, { now: () => 1000 });
    const loaded = store.load();

    expect(loaded).toBeNull();
    expect(storage.getItem('payment_flow_context_v1')).toBeNull();
  });
});
