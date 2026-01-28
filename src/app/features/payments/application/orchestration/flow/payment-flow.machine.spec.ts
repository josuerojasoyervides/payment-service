import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { createActor } from 'xstate';

import { createPaymentFlowMachine } from './payment-flow.machine';
import { FlowContextStore, KeyValueStorage, toFlowContext } from './payment-flow.persistence';
import { PaymentFlowConfigOverrides } from './payment-flow.policy';
import { PaymentFlowActorRef, PaymentFlowSnapshot } from './payment-flow.types';

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

describe('PaymentFlowMachine', () => {
  const baseIntent: PaymentIntent = {
    id: 'pi_1',
    provider: 'stripe',
    status: 'processing',
    amount: 100,
    currency: 'MXN',
  };

  const waitForSnapshot = (
    actor: PaymentFlowActorRef,
    predicate: (snap: PaymentFlowSnapshot) => boolean,
  ) =>
    new Promise<PaymentFlowSnapshot>((resolve, reject) => {
      const current = actor.getSnapshot() as PaymentFlowSnapshot;
      if (predicate(current)) {
        resolve(current);
        return;
      }

      let sub: { unsubscribe: () => void } | null = null;

      const timeout = setTimeout(() => {
        sub?.unsubscribe();
        reject(new Error('Timeout waiting for snapshot'));
      }, 200);

      sub = actor.subscribe((snap) => {
        if (predicate(snap as PaymentFlowSnapshot)) {
          clearTimeout(timeout);
          sub?.unsubscribe();
          resolve(snap as PaymentFlowSnapshot);
        }
      });
    });

  const setup = (
    overrides?: Partial<{
      startIntent: PaymentIntent;
      statusIntent: PaymentIntent;
      startReject: boolean;
      statusReject: boolean;
      config: PaymentFlowConfigOverrides;
    }>,
  ) => {
    const deps = {
      startPayment: vi.fn(async () => {
        if (overrides?.startReject) throw new Error('start failed');
        return overrides?.startIntent ?? baseIntent;
      }),
      confirmPayment: vi.fn(async () => baseIntent),
      cancelPayment: vi.fn(async () => ({ ...baseIntent, status: 'canceled' as const })),
      getStatus: vi.fn(async () => {
        if (overrides?.statusReject) throw new Error('status failed');
        return overrides?.statusIntent ?? baseIntent;
      }),
    };

    const machine = createPaymentFlowMachine(deps, overrides?.config);
    const actor = createActor(machine) as PaymentFlowActorRef;
    actor.start();

    return { actor, deps };
  };

  it('starts in idle', () => {
    const { actor } = setup();
    const snap = actor.getSnapshot() as PaymentFlowSnapshot;

    expect(snap.value).toBe('idle');
    expect(snap.hasTag('idle')).toBe(true);
  });

  it('START -> polling when intent is not final and needs no action', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'processing' },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'polling');
    expect(snap.hasTag('ready')).toBe(true);
  });

  it('START -> requiresAction when intent needs user action', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'requires_action' },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'requiresAction');
    expect(snap.hasTag('ready')).toBe(true);
  });

  it('START -> done when intent is final', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'succeeded' },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done');
    expect(snap.hasTag('ready')).toBe(true);
  });

  it('REFRESH uses context intentId when event is missing it', async () => {
    const { actor, deps } = setup({
      startIntent: { ...baseIntent, id: 'pi_ctx', status: 'processing' },
      statusIntent: { ...baseIntent, id: 'pi_ctx', status: 'processing' },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({
      type: 'REFRESH',
      providerId: 'stripe',
    } as any);

    await waitForSnapshot(actor, (s) => s.value === 'fetchingStatusInvoke');
    await waitForSnapshot(actor, (s) => s.value === 'polling');

    expect(deps.getStatus).toHaveBeenCalledWith('stripe', { intentId: 'pi_ctx' });
  });

  it('REFRESH fails when keys are missing', async () => {
    const { actor, deps } = setup();

    actor.send({
      type: 'REFRESH',
      providerId: 'stripe',
    } as any);

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.hasTag('error')).toBe(true);
    expect(deps.getStatus).not.toHaveBeenCalled();
  });

  it('CONFIRM from idle uses event payload', async () => {
    const { actor, deps } = setup();

    actor.send({
      type: 'CONFIRM',
      providerId: 'paypal',
      intentId: 'ORDER_1',
      returnUrl: 'https://return.test',
    });

    await waitForSnapshot(
      actor,
      (s) => s.value === 'afterConfirm' || s.value === 'polling' || s.value === 'done',
    );

    expect(deps.confirmPayment).toHaveBeenCalledWith('paypal', {
      intentId: 'ORDER_1',
      returnUrl: 'https://return.test',
    });
  });

  it('CANCEL from idle uses event payload', async () => {
    const { actor, deps } = setup();

    actor.send({
      type: 'CANCEL',
      providerId: 'stripe',
      intentId: 'pi_cancel',
    });

    await waitForSnapshot(actor, (s) => s.value === 'cancelling');
    await waitForSnapshot(actor, (s) => s.value === 'done');

    expect(deps.cancelPayment).toHaveBeenCalledWith('stripe', { intentId: 'pi_cancel' });
  });

  it('REFRESH fails when providerId is missing', async () => {
    const { actor, deps } = setup();

    actor.send({
      type: 'REFRESH',
      intentId: 'pi_missing_provider',
    } as any);

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.hasTag('error')).toBe(true);
    expect(deps.getStatus).not.toHaveBeenCalled();
  });

  it('FALLBACK_REQUESTED -> fallbackCandidate', async () => {
    const { actor } = setup({ startReject: true });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'failed');

    actor.send({
      type: 'FALLBACK_REQUESTED',
      failedProviderId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
      mode: 'manual',
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'fallbackCandidate');
    expect(snap.hasTag('ready')).toBe(true);
    expect(snap.context.fallback.eligible).toBe(true);
  });

  it('status errors retry with backoff before failing', async () => {
    const { actor } = setup({
      statusReject: true,
      config: {
        polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 2 },
        statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 1 },
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({ type: 'REFRESH', providerId: 'stripe' } as any);

    const retrySnap = await waitForSnapshot(actor, (s) => s.value === 'statusRetrying');
    expect(retrySnap.context.statusRetry.count).toBe(1);
  });

  it('status errors fail when retry limit reached', async () => {
    const { actor } = setup({
      statusReject: true,
      config: {
        polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 1 },
        statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_123' },
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({ type: 'REFRESH', providerId: 'stripe' } as any);

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.hasTag('error')).toBe(true);
  });

  it('rehydrates context and reconciles external events on re-entry', async () => {
    const storage = new MemoryStorage();
    const store = new FlowContextStore(storage, { now: () => 1000 });
    const flowContext: PaymentFlowContext = {
      flowId: 'flow_reentry',
      providerId: 'stripe',
      providerRefs: { stripe: { intentId: 'pi_reentry' } },
      createdAt: 1000,
      expiresAt: 2000,
    };

    store.save(flowContext);
    const persisted = store.load();
    expect(persisted).toBeTruthy();

    const initialContext = persisted
      ? {
          flowContext: toFlowContext(persisted),
          providerId: flowContext.providerId ?? null,
          intentId: flowContext.providerRefs?.stripe?.intentId ?? null,
        }
      : undefined;

    const deps = {
      startPayment: vi.fn(async () => baseIntent),
      confirmPayment: vi.fn(async () => baseIntent),
      cancelPayment: vi.fn(async () => ({ ...baseIntent, status: 'canceled' as const })),
      getStatus: vi.fn(async () => ({
        ...baseIntent,
        id: 'pi_reentry',
        status: 'succeeded' as const,
      })),
    };

    const machine = createPaymentFlowMachine(deps, {}, initialContext);
    const actor = createActor(machine) as PaymentFlowActorRef;
    actor.start();

    actor.send({
      type: 'WEBHOOK_RECEIVED',
      payload: { providerId: 'stripe', referenceId: 'pi_reentry' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done');
    expect(snap.context.flowContext?.flowId).toBe('flow_reentry');
    expect(deps.getStatus).toHaveBeenCalledWith('stripe', { intentId: 'pi_reentry' });
  });
});
