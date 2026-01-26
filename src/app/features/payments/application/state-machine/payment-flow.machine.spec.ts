import { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { createActor } from 'xstate';

import { createPaymentFlowMachine } from './payment-flow.machine';
import { PaymentFlowActorRef, PaymentFlowSnapshot } from './payment-flow.types';

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
    }>,
  ) => {
    const deps = {
      startPayment: vi.fn(async () => {
        if (overrides?.startReject) throw new Error('start failed');
        return overrides?.startIntent ?? baseIntent;
      }),
      confirmPayment: vi.fn(async () => baseIntent),
      cancelPayment: vi.fn(async () => ({ ...baseIntent, status: 'canceled' as const })),
      getStatus: vi.fn(async () => overrides?.statusIntent ?? baseIntent),
    };

    const machine = createPaymentFlowMachine(deps);
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
});
