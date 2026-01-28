import { PaymentFlowContext } from '@payments/domain/models/payment/payment-flow-context.types';
import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { AnyActorRef, createActor } from 'xstate';

import { createPaymentFlowMachine } from './payment-flow.machine';
import { KeyValueStorage } from './payment-flow.persistence';
import { PaymentFlowActorRef, PaymentFlowSnapshot } from './payment-flow.types';

let activeActors: AnyActorRef[] = [];

class _MemoryStorage implements KeyValueStorage {
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

const waitForSnapshot = (
  actor: PaymentFlowActorRef,
  predicate: (snap: PaymentFlowSnapshot) => boolean,
  timeoutMs = 500, // Un poco más de margen para evitar rejects falsos
) => {
  const current = actor.getSnapshot() as PaymentFlowSnapshot;
  if (predicate(current)) return Promise.resolve(current);

  return new Promise<PaymentFlowSnapshot>((resolve, reject) => {
    let sub: { unsubscribe: () => void } | null = null;

    const timeout = setTimeout(() => {
      sub?.unsubscribe();
      reject(new Error(`Timeout waiting for snapshot state: ${actor.getSnapshot().value}`));
    }, timeoutMs);

    sub = actor.subscribe((snap) => {
      if (predicate(snap as PaymentFlowSnapshot)) {
        clearTimeout(timeout);
        sub?.unsubscribe();
        resolve(snap as PaymentFlowSnapshot);
      }
    });
  });
};

describe('PaymentFlowMachine', () => {
  const baseIntent: PaymentIntent = {
    id: 'pi_1',
    provider: 'stripe',
    status: 'processing',
    amount: 100,
    currency: 'MXN',
  };

  afterEach(() => {
    activeActors.forEach((actor) => actor.stop());
    activeActors = [];
    vi.clearAllMocks();
  });

  const setup = (overrides?: any) => {
    const deps = {
      startPayment: vi.fn(async () =>
        overrides?.startReject
          ? (() => {
              throw new Error();
            })()
          : (overrides?.startIntent ?? baseIntent),
      ),
      confirmPayment: vi.fn(async () => baseIntent),
      cancelPayment: vi.fn(async () => ({ ...baseIntent, status: 'canceled' as const })),
      getStatus: vi.fn(async () =>
        overrides?.statusReject
          ? (() => {
              throw new Error();
            })()
          : (overrides?.statusIntent ?? baseIntent),
      ),
      clientConfirm: vi.fn(async () =>
        overrides?.clientConfirmReject
          ? (() => {
              throw new Error();
            })()
          : (overrides?.clientConfirmIntent ?? baseIntent),
      ),
      finalize: vi.fn(async () =>
        overrides?.finalizeReject
          ? (() => {
              throw new Error();
            })()
          : (overrides?.finalizeIntent ?? baseIntent),
      ),
    };

    const machine = createPaymentFlowMachine(deps, overrides?.config, overrides?.initialContext);
    const actor = createActor(machine) as PaymentFlowActorRef;
    actor.start();

    activeActors.push(actor); // Trackear para el afterEach
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

  it('requiresAction -> clientConfirming -> reconciling for client_confirm actions', async () => {
    const { actor, deps } = setup({
      startIntent: {
        ...baseIntent,
        status: 'requires_action',
        nextAction: { kind: 'client_confirm', token: 'tok_runtime' },
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

    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: 'pi_1',
    });

    await waitForSnapshot(actor, (s) => s.value === 'clientConfirming');
    expect(deps.clientConfirm).toHaveBeenCalled();

    await waitForSnapshot(
      actor,
      (s) => s.value === 'reconciling' || s.value === 'reconcilingInvoke',
    );
  });

  it('clientConfirming failure transitions to failed with error', async () => {
    const { actor } = setup({
      startIntent: {
        ...baseIntent,
        status: 'requires_action',
        nextAction: { kind: 'client_confirm', token: 'tok_runtime' },
      },
      clientConfirmReject: true,
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

    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: 'pi_1',
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.hasTag('error')).toBe(true);
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

  it('afterStatus -> finalizing -> reconciling when finalize is required', async () => {
    const { actor, deps } = setup({
      statusIntent: {
        ...baseIntent,
        status: 'processing',
        finalizeRequired: true,
      },
      finalizeIntent: {
        ...baseIntent,
        status: 'processing',
        finalizeRequired: false,
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

    actor.send({
      type: 'EXTERNAL_STATUS_UPDATED',
      payload: { providerId: 'stripe', referenceId: 'pi_1' },
    });

    await waitForSnapshot(actor, (s) => s.value === 'finalizing');
    expect(deps.finalize).toHaveBeenCalled();

    await waitForSnapshot(
      actor,
      (s) => s.value === 'reconciling' || s.value === 'reconcilingInvoke',
    );
  });

  it('finalizing failure transitions to failed with error', async () => {
    const { actor } = setup({
      statusIntent: {
        ...baseIntent,
        status: 'processing',
        finalizeRequired: true,
      },
      finalizeReject: true,
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
      type: 'EXTERNAL_STATUS_UPDATED',
      payload: { providerId: 'stripe', referenceId: 'pi_1' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.hasTag('error')).toBe(true);
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
    const flowContext: PaymentFlowContext = {
      flowId: 'flow_reentry',
      providerId: 'stripe',
      providerRefs: { stripe: { intentId: 'pi_reentry' } },
      createdAt: 1000,
      expiresAt: 2000,
    };

    const { actor, deps } = setup({
      initialContext: {
        flowContext,
        providerId: 'stripe',
        intentId: 'pi_reentry',
      },

      statusIntent: {
        ...baseIntent,
        id: 'pi_reentry',
        status: 'succeeded',
      },
    });

    actor.send({
      type: 'WEBHOOK_RECEIVED',
      payload: { providerId: 'stripe', referenceId: 'pi_reentry' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done', 1500);

    expect(snap.context.flowContext?.flowId).toBe('flow_reentry');
    expect(deps.getStatus).toHaveBeenCalledWith('stripe', { intentId: 'pi_reentry' });
  });

  it('preserves provider refs across id swap and resolves canonical status reference', async () => {
    const initialContext = {
      flowContext: {
        flowId: 'flow_swap',
        providerId: 'stripe' as const,
        providerRefs: { stripe: { preferenceId: 'pref_1' } },
      },
      providerId: 'stripe' as const,
      intentId: null,
    };

    const deps = {
      startPayment: vi.fn(async () => baseIntent),
      confirmPayment: vi.fn(async () => baseIntent),
      cancelPayment: vi.fn(async () => ({ ...baseIntent, status: 'canceled' as const })),
      getStatus: vi.fn(async () => ({
        ...baseIntent,
        id: 'pi_swap',
        status: 'succeeded' as const,
        providerRefs: { preferenceId: 'pref_1', paymentId: 'pay_1' },
      })),
      clientConfirm: vi.fn(async () => baseIntent),
      finalize: vi.fn(async () => baseIntent),
    };

    const machine = createPaymentFlowMachine(deps, {}, initialContext);
    const actor = createActor(machine) as PaymentFlowActorRef;
    actor.start();

    actor.send({
      type: 'EXTERNAL_STATUS_UPDATED',
      payload: { providerId: 'stripe', referenceId: 'pay_1' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done');
    expect(deps.getStatus).toHaveBeenCalledWith('stripe', { intentId: 'pay_1' });
    expect(snap.context.flowContext?.providerRefs?.stripe?.preferenceId).toBe('pref_1');
    expect(snap.context.flowContext?.providerRefs?.stripe?.paymentId).toBe('pay_1');
  });
});
