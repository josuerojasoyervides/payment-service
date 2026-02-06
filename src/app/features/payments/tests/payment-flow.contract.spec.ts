import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import { createPaymentFlowMachine } from '@payments/application/orchestration/flow/payment-flow.machine';
import type {
  PaymentFlowActorRef,
  PaymentFlowMachineContext,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import type { PaymentFlowConfigOverrides } from '@payments/application/orchestration/flow/payment-flow/policy/payment-flow.policy';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { createPaymentError } from '@payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { createActor } from 'xstate';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const baseIntent: PaymentIntent = {
  id: createPaymentIntentId('pi_1'),
  provider: 'stripe',
  status: 'processing',
  money: { amount: 100, currency: 'MXN' },
};

const baseRequest: CreatePaymentRequest = {
  orderId: createOrderId('o1'),
  money: { amount: 100, currency: 'MXN' },
  method: { type: 'card' as const, token: 'tok_123' },
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
    startDeferred: Deferred<PaymentIntent>;
    confirmDeferred: Deferred<PaymentIntent>;
    cancelDeferred: Deferred<PaymentIntent>;
    statusDeferred: Deferred<PaymentIntent>;
    finalizeUnsupportedFinalize: boolean;
    config: PaymentFlowConfigOverrides;
    initialContext: Partial<PaymentFlowMachineContext>;
  }>,
) => {
  const deps = {
    startPayment: vi.fn(async () => {
      if (overrides?.startReject) throw new Error('start failed');
      if (overrides?.startDeferred) return overrides.startDeferred.promise;
      return overrides?.startIntent ?? baseIntent;
    }),
    confirmPayment: vi.fn(async () => {
      if (overrides?.confirmDeferred) return overrides.confirmDeferred.promise;
      return baseIntent;
    }),
    cancelPayment: vi.fn(async () => {
      if (overrides?.cancelDeferred) return overrides.cancelDeferred.promise;
      return { ...baseIntent, status: 'canceled' as const };
    }),
    getStatus: vi.fn(async () => {
      if (overrides?.statusReject) throw new Error('status failed');
      if (overrides?.statusDeferred) return overrides.statusDeferred.promise;
      return overrides?.statusIntent ?? baseIntent;
    }),
    clientConfirm: vi.fn(async () => baseIntent),
    finalize: vi.fn(async () => {
      if (overrides?.finalizeUnsupportedFinalize) {
        throw createPaymentError(
          'unsupported_finalize',
          'errors.unsupported_finalize',
          undefined,
          null,
        );
      }
      return baseIntent;
    }),
  };

  const config: PaymentFlowConfigOverrides = overrides?.config ?? {
    polling: { baseDelayMs: 100000, maxDelayMs: 100000, maxAttempts: 99 },
    statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
  };

  const machine = createPaymentFlowMachine(deps, config, overrides?.initialContext);
  const actor = createActor(machine) as PaymentFlowActorRef;
  actor.start();

  return { actor, deps };
};

describe('PaymentFlow contract tests', () => {
  it('idle accepts START -> starting', async () => {
    const startDeferred = createDeferred<PaymentIntent>();
    const { actor } = setup({ startDeferred });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'starting');
    expect(snap.value).toBe('starting');

    startDeferred.resolve({ ...baseIntent, status: 'processing' });
  });

  it('idle accepts CONFIRM -> confirming', async () => {
    const confirmDeferred = createDeferred<PaymentIntent>();
    const { actor } = setup({ confirmDeferred });

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_confirm'),
      returnUrl: 'https://return.test',
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'confirming');
    expect(snap.value).toBe('confirming');

    confirmDeferred.resolve(baseIntent);
  });

  it('idle accepts CANCEL -> cancelling', async () => {
    const cancelDeferred = createDeferred<PaymentIntent>();
    const { actor } = setup({ cancelDeferred });

    actor.send({
      type: 'CANCEL',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_cancel'),
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'cancelling');
    expect(snap.value).toBe('cancelling');

    cancelDeferred.resolve({ ...baseIntent, status: 'canceled' as const });
  });

  it('idle accepts REFRESH -> fetchingStatusInvoke when keys provided', async () => {
    const statusDeferred = createDeferred<PaymentIntent>();
    const { actor } = setup({ statusDeferred });

    actor.send({
      type: 'REFRESH',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_refresh'),
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'fetchingStatusInvoke');
    expect(snap.value).toBe('fetchingStatusInvoke');

    statusDeferred.resolve(baseIntent);
  });

  it('idle ignores FALLBACK_REQUESTED', async () => {
    const { actor } = setup();
    expect(actor.getSnapshot().value).toBe('idle');

    actor.send({
      type: 'FALLBACK_REQUESTED',
      failedProviderId: 'stripe',
      request: baseRequest,
      mode: 'manual',
    });

    await flush();
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('requiresAction accepts CONFIRM -> confirming', async () => {
    const confirmDeferred = createDeferred<PaymentIntent>();
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'requires_action' },
      confirmDeferred,
    });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_req'),
    });
    const snap = await waitForSnapshot(actor, (s) => s.value === 'confirming');
    expect(snap.value).toBe('confirming');

    confirmDeferred.resolve(baseIntent);
  });

  it('requiresAction ignores START', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'requires_action' },
    });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await flush();
    expect(actor.getSnapshot().value).toBe('requiresAction');
  });

  it('polling accepts REFRESH -> fetchingStatusInvoke', async () => {
    const statusDeferred = createDeferred<PaymentIntent>();
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'processing' },
      statusDeferred,
    });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({ type: 'REFRESH', providerId: 'stripe' });
    const snap = await waitForSnapshot(actor, (s) => s.value === 'fetchingStatusInvoke');
    expect(snap.value).toBe('fetchingStatusInvoke');

    statusDeferred.resolve(baseIntent);
  });

  it('polling ignores START', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'processing' },
    });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await flush();
    expect(actor.getSnapshot().value).toBe('polling');
  });

  it('requiresAction accepts REDIRECT_RETURNED -> finalizing -> reconcilingInvoke', async () => {
    const statusDeferred = createDeferred<PaymentIntent>();
    const { actor, deps } = setup({
      startIntent: { ...baseIntent, status: 'requires_action' },
      statusDeferred,
    });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    // referenceId must match stored ref (intent id from start) to avoid correlation mismatch
    actor.send({
      type: 'REDIRECT_RETURNED',
      payload: { providerId: 'stripe', referenceId: baseIntent.id.value },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'reconcilingInvoke');
    expect(snap.value).toBe('reconcilingInvoke');
    expect(deps.finalize).toHaveBeenCalledTimes(1);

    statusDeferred.resolve({ ...baseIntent, id: baseIntent.id, status: 'succeeded' });
    await waitForSnapshot(actor, (s) => s.value === 'done');

    expect(deps.getStatus).toHaveBeenCalledWith('stripe', { intentId: baseIntent.id });
  });

  it('two identical REDIRECT_RETURNED events invoke finalize once (dedupe)', async () => {
    const statusDeferred = createDeferred<PaymentIntent>();
    const { actor, deps } = setup({
      startIntent: { ...baseIntent, status: 'requires_action' },
      statusDeferred,
    });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    const payload = { providerId: 'stripe' as const, referenceId: baseIntent.id.value };
    actor.send({ type: 'REDIRECT_RETURNED', payload });
    actor.send({ type: 'REDIRECT_RETURNED', payload });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'reconcilingInvoke');
    expect(snap.value).toBe('reconcilingInvoke');
    expect(deps.finalize).toHaveBeenCalledTimes(1);

    statusDeferred.resolve({ ...baseIntent, id: baseIntent.id, status: 'succeeded' });
    await waitForSnapshot(actor, (s) => s.value === 'done');
  });

  it('REDIRECT_RETURNED with unsupported_finalize transitions to reconciling not failed', async () => {
    const statusDeferred = createDeferred<PaymentIntent>();
    const { actor, deps } = setup({
      statusDeferred,
      finalizeUnsupportedFinalize: true,
    });

    actor.send({
      type: 'REDIRECT_RETURNED',
      payload: { providerId: 'stripe', referenceId: 'pi_return' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'reconcilingInvoke');
    expect(snap.value).toBe('reconcilingInvoke');
    expect(snap.hasTag('error')).toBe(false);
    expect(deps.finalize).toHaveBeenCalledTimes(1);

    const piReturn = createPaymentIntentId('pi_return');
    statusDeferred.resolve({ ...baseIntent, id: piReturn, status: 'succeeded' });
    await waitForSnapshot(actor, (s) => s.value === 'done');
    expect(deps.getStatus).toHaveBeenCalledWith('stripe', { intentId: piReturn });
  });

  it('REDIRECT_RETURNED with referenceId mismatch vs stored ref -> failed, no finalize', async () => {
    const { actor, deps } = setup({
      initialContext: {
        providerId: 'stripe',
        intentId: createPaymentIntentId('pi_A'),
        flowContext: {
          providerId: 'stripe',
          providerRefs: { stripe: { paymentId: 'pi_A' } },
        },
      },
    });

    actor.send({
      type: 'REDIRECT_RETURNED',
      payload: { providerId: 'stripe', referenceId: 'pi_B' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.context.error?.code).toBe('return_correlation_mismatch');
    expect(deps.finalize).toHaveBeenCalledTimes(0);
  });

  it('idle accepts EXTERNAL_STATUS_UPDATED -> reconcilingInvoke', async () => {
    const statusDeferred = createDeferred<PaymentIntent>();
    const { actor, deps } = setup({ statusDeferred });

    actor.send({
      type: 'EXTERNAL_STATUS_UPDATED',
      payload: { providerId: 'paypal', referenceId: 'ORDER_123', eventId: 'evt_paypal_1' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'reconcilingInvoke');
    expect(snap.value).toBe('reconcilingInvoke');

    const order123 = createPaymentIntentId('ORDER_123');
    statusDeferred.resolve({
      ...baseIntent,
      provider: 'paypal',
      id: order123,
      status: 'processing',
    });
    await waitForSnapshot(actor, (s) => s.value === 'polling');

    expect(deps.getStatus).toHaveBeenCalledWith('paypal', { intentId: order123 });
  });

  it('idle accepts WEBHOOK_RECEIVED -> reconcilingInvoke', async () => {
    const statusDeferred = createDeferred<PaymentIntent>();
    const { actor, deps } = setup({ statusDeferred });

    actor.send({
      type: 'WEBHOOK_RECEIVED',
      payload: {
        providerId: 'stripe',
        referenceId: 'pi_webhook',
        eventId: 'evt_stripe_1',
        raw: { id: 'evt_1' },
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'reconcilingInvoke');
    expect(snap.value).toBe('reconcilingInvoke');

    statusDeferred.resolve({
      ...baseIntent,
      id: createPaymentIntentId('pi_webhook'),
      status: 'succeeded',
    });
    await waitForSnapshot(actor, (s) => s.value === 'done');

    expect(deps.getStatus).toHaveBeenCalledWith(
      'stripe',
      expect.objectContaining({ intentId: expect.objectContaining({ value: 'pi_webhook' }) }),
    );
  });

  it('failed accepts FALLBACK_REQUESTED -> fallbackConfirming', async () => {
    const { actor } = setup({ startReject: true });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'failed');

    actor.send({
      type: 'FALLBACK_REQUESTED',
      failedProviderId: 'stripe',
      request: baseRequest,
      mode: 'manual',
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'fallbackConfirming');
    expect(snap.value).toBe('fallbackConfirming');
  });

  it('failed ignores START', async () => {
    const { actor } = setup({ startReject: true });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'failed');

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await flush();
    expect(actor.getSnapshot().value).toBe('failed');
  });

  it('fallbackConfirming accepts FALLBACK_ABORT -> done', async () => {
    const { actor } = setup({ startReject: true });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'failed');

    actor.send({
      type: 'FALLBACK_REQUESTED',
      failedProviderId: 'stripe',
      request: baseRequest,
      mode: 'manual',
    });
    await waitForSnapshot(actor, (s) => s.value === 'fallbackConfirming');

    actor.send({ type: 'FALLBACK_ABORT' });
    const snap = await waitForSnapshot(actor, (s) => s.value === 'done');
    expect(snap.value).toBe('done');
  });

  it('fallbackConfirming ignores CONFIRM', async () => {
    const { actor } = setup({ startReject: true });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'failed');

    actor.send({
      type: 'FALLBACK_REQUESTED',
      failedProviderId: 'stripe',
      request: baseRequest,
      mode: 'manual',
    });
    await waitForSnapshot(actor, (s) => s.value === 'fallbackConfirming');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_fallback'),
    });
    await flush();
    expect(actor.getSnapshot().value).toBe('fallbackConfirming');
  });

  it('done accepts RESET -> idle', async () => {
    const { actor } = setup({ startIntent: { ...baseIntent, status: 'succeeded' } });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'done');

    actor.send({ type: 'RESET' });
    const snap = await waitForSnapshot(actor, (s) => s.value === 'idle');
    expect(snap.value).toBe('idle');
  });

  it('done ignores START', async () => {
    const { actor } = setup({ startIntent: { ...baseIntent, status: 'succeeded' } });

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await waitForSnapshot(actor, (s) => s.value === 'done');

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await flush();
    expect(actor.getSnapshot().value).toBe('done');
  });

  it('confirming ignores START while invoke is in flight', async () => {
    const confirmDeferred = createDeferred<PaymentIntent>();
    const { actor } = setup({ confirmDeferred });

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_confirm'),
    });
    await waitForSnapshot(actor, (s) => s.value === 'confirming');

    actor.send({ type: 'START', providerId: 'stripe', request: baseRequest });
    await flush();
    expect(actor.getSnapshot().value).toBe('confirming');

    confirmDeferred.resolve(baseIntent);
  });
});
