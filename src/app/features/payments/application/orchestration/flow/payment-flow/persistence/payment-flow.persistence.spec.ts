import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';
import { FLOW_CONTEXT_TTL_MS } from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import {
  FLOW_CONTEXT_SCHEMA_VERSION,
  FlowContextStore,
} from '@payments/application/orchestration/flow/payment-flow/persistence/payment-flow.persistence';
import type { PaymentFlowContext } from '@payments/domain/subdomains/payment/entities/payment-flow-context.types';

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

  it('allowlist never stores clientSecret or client_confirm token in persisted payload', () => {
    const storage = new MemoryStorage();
    const store = new FlowContextStore(storage, { now: () => 1000 });

    const clientSecretValue = 'pi_abc_secret_xyz';
    const clientConfirmTokenValue = 'tok_runtime_123';
    const context: PaymentFlowContext = {
      flowId: 'flow_1',
      metadata: {
        clientSecret: clientSecretValue,
        clientConfirmToken: clientConfirmTokenValue,
      },
    };

    store.save(context);

    const raw = storage.getItem('payment_flow_context_v1');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.metadata).toBeUndefined();
    expect(parsed).not.toHaveProperty('clientSecret');
    expect(parsed).not.toHaveProperty('nextAction');

    expect(raw).not.toContain(clientSecretValue);
    expect(raw).not.toContain(clientConfirmTokenValue);
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
