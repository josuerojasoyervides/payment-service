import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';
import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import { createPaymentFlowMachine } from '@payments/application/orchestration/flow/payment-flow.machine';
import type {
  PaymentFlowActorRef,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import type { PaymentFlowContext } from '@payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { createPaymentError } from '@payments/domain/subdomains/payment/factories/payment-error.factory';
import { firstValueFrom, of } from 'rxjs';
import type { AnyActorRef } from 'xstate';
import { createActor } from 'xstate';

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
    id: createPaymentIntentId('pi_1'),
    provider: 'stripe',
    status: 'processing',
    money: { amount: 100, currency: 'MXN' },
  };

  afterEach(() => {
    activeActors.forEach((actor) => actor.stop());
    activeActors = [];
    vi.clearAllMocks();
    vi.useRealTimers();
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
      clientConfirm: vi.fn(async () => {
        if (overrides?.clientConfirmError) {
          throw overrides.clientConfirmError;
        }
        if (overrides?.clientConfirmReject) {
          throw createPaymentError(
            'unsupported_client_confirm',
            'errors.unsupported_client_confirm',
            undefined,
            null,
          );
        }
        return overrides?.clientConfirmIntent ?? baseIntent;
      }),
      finalize: vi.fn(async () => {
        if (overrides?.finalizeReject) throw new Error();
        if (overrides?.finalizeUnsupportedFinalize) {
          throw createPaymentError(
            'unsupported_finalize',
            'errors.unsupported_finalize',
            undefined,
            null,
          );
        }
        return overrides?.finalizeIntent ?? baseIntent;
      }),
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
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'polling');
    expect(snap.hasTag('ready')).toBe(true);
  });

  it('increments polling attempts across status refreshes (avoids infinite polling)', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'processing' },
      statusIntent: { ...baseIntent, status: 'processing' },
      config: {
        polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 2 },
        statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
        processing: { maxDurationMs: 60_000 },
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    let snap = await waitForSnapshot(actor, (s) => s.value === 'polling');
    expect(snap.context.polling.attempt).toBe(1);

    snap = await waitForSnapshot(
      actor,
      (s) => s.value === 'polling' && s.context.polling.attempt === 2,
      500,
    );
    expect(snap.context.polling.attempt).toBe(2);
  });

  it('polling -> requiresAction when status returns requires_confirmation', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'processing' },
      statusIntent: { ...baseIntent, status: 'requires_confirmation' },
      config: {
        polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 2 },
        statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
        processing: { maxDurationMs: 60_000 },
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'requiresAction', 500);
    expect(snap.context.intent?.status).toBe('requires_confirmation');
  });

  it('START -> requiresAction when intent needs user action', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'requires_action' },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'requiresAction');
    expect(snap.hasTag('ready')).toBe(true);
  });

  it('START -> requiresAction when intent requires confirmation', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'requires_confirmation' },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'requiresAction');
    expect(snap.context.intent?.status).toBe('requires_confirmation');
  });

  it('client_confirm success: requiresAction -> clientConfirming -> reconciling when deps.clientConfirm resolves', async () => {
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
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_1'),
    });

    await waitForSnapshot(actor, (s) => s.value === 'clientConfirming');
    expect(deps.clientConfirm).toHaveBeenCalled();

    await waitForSnapshot(
      actor,
      (s) => s.value === 'reconciling' || s.value === 'reconcilingInvoke',
    );
  });

  it('client_confirm success: full path uses ProviderFactoryRegistry capability routing', async () => {
    const resolvedIntent: PaymentIntent = {
      ...baseIntent,
      status: 'succeeded',
      id: createPaymentIntentId('pi_1'),
    };
    const startIntentWithClientConfirm: PaymentIntent = {
      ...baseIntent,
      status: 'requires_action',
      nextAction: { kind: 'client_confirm', token: 'tok_runtime' },
    };
    const mockHandlerExecute = vi.fn(
      (_req: { providerId: string; action: unknown; context: unknown }) => of(resolvedIntent),
    );
    const mockHandler = { execute: mockHandlerExecute };
    const mockFactory = { getClientConfirmHandler: () => mockHandler };
    const mockRegistry = {
      has: () => true,
      get: () => mockFactory,
    };

    const deps = {
      startPayment: vi.fn(async () => startIntentWithClientConfirm),
      confirmPayment: vi.fn(async () => baseIntent),
      cancelPayment: vi.fn(async () => ({ ...baseIntent, status: 'canceled' as const })),
      getStatus: vi.fn(async () => baseIntent),
      clientConfirm: vi.fn(
        async (request: { providerId: string; action: unknown; context: PaymentFlowContext }) => {
          const factory = mockRegistry.get();
          const handler = factory.getClientConfirmHandler?.();
          if (!handler)
            throw createPaymentError(
              'unsupported_client_confirm',
              'errors.unsupported_client_confirm',
              undefined,
              null,
            );
          return firstValueFrom(handler.execute(request));
        },
      ),
      finalize: vi.fn(async () => baseIntent),
    };

    const config = {
      polling: { baseDelayMs: 100000, maxDelayMs: 100000, maxAttempts: 99 },
      statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
    };
    const machine = createPaymentFlowMachine(deps, config);
    const actor = createActor(machine) as PaymentFlowActorRef;
    actor.start();
    activeActors.push(actor);

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_1'),
    });

    await waitForSnapshot(actor, (s) => s.value === 'clientConfirming');

    await waitForSnapshot(
      actor,
      (s) => s.value === 'reconciling' || s.value === 'reconcilingInvoke',
    );

    expect(mockHandlerExecute).toHaveBeenCalledTimes(1);
    expect(mockHandlerExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'stripe',
        action: { kind: 'client_confirm', token: 'tok_runtime' },
      }),
    );
    expect(deps.clientConfirm).toHaveBeenCalledTimes(1);
  });

  it('clientConfirming failure returns to requiresAction with PaymentError (unsupported_client_confirm)', async () => {
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
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_1'),
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'requiresAction');
    expect(snap.hasTag('ready')).toBe(true);
    expect(snap.context.error?.code).toBe('unsupported_client_confirm');
    expect(snap.context.error?.messageKey).toBe('errors.unsupported_client_confirm');
  });

  it('START -> done when intent is final', async () => {
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'succeeded' },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
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
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
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

  it('finalizing failure transitions to finalizeRetrying with error', async () => {
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
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({
      type: 'EXTERNAL_STATUS_UPDATED',
      payload: { providerId: 'stripe', referenceId: 'pi_1' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'finalizeRetrying');
    expect(snap.hasTag('loading')).toBe(true);
    expect(snap.context.finalizeRetry.count).toBe(1);
    expect(snap.context.error).toBeTruthy();
  });

  it('finalizing unsupported_finalize transitions to reconciling not failed', async () => {
    const { actor, deps } = setup({
      finalizeUnsupportedFinalize: true,
      statusIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_return'),
        status: 'succeeded',
      },
    });

    actor.send({
      type: 'REDIRECT_RETURNED',
      payload: { providerId: 'stripe', referenceId: 'pi_return' },
    });

    const snap = await waitForSnapshot(
      actor,
      (s) => s.value === 'reconciling' || s.value === 'reconcilingInvoke',
      500,
    );
    expect(snap.hasTag('error')).toBe(false);
    expect(deps.finalize).toHaveBeenCalledTimes(1);

    await waitForSnapshot(actor, (s) => s.value === 'done');
  });

  it('REDIRECT_RETURNED duplicate: same referenceId twice skips finalize (dedupe)', async () => {
    const { actor, deps } = setup({
      initialContext: {
        providerId: 'stripe',
        intentId: createPaymentIntentId('pi_return'),
        flowContext: {
          providerId: 'stripe',
          lastReturnReferenceId: 'pi_return',
          lastReturnAt: Date.now(),
        },
      },
      statusIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_return'),
        status: 'succeeded',
      },
    });

    const before = actor.getSnapshot() as PaymentFlowSnapshot;
    expect(before.value).toBe('idle');
    expect(before.context.flowContext?.lastReturnNonce).toBeUndefined();

    actor.send({
      type: 'REDIRECT_RETURNED',
      payload: { providerId: 'stripe', referenceId: 'pi_return' },
    });

    const snap = actor.getSnapshot() as PaymentFlowSnapshot;
    // Duplicate return is a no-op: machine stays in the same state.
    expect(snap.value).toBe('idle');
    // markReturnProcessed must not run for duplicates (nonce remains undefined).
    expect(snap.context.flowContext?.lastReturnNonce).toBeUndefined();
    // No finalize call should be triggered on duplicates.
    expect(deps.finalize).toHaveBeenCalledTimes(0);
  });

  it('REDIRECT_RETURNED correlation mismatch: stored ref differs from event -> failed, no finalize', async () => {
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

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed', 500);
    expect(snap.context.error?.code).toBe('return_correlation_mismatch');
    expect(snap.context.error?.messageKey).toBe('errors.return_correlation_mismatch');
    expect(deps.finalize).toHaveBeenCalledTimes(0);
  });

  it('REFRESH uses context intentId when event is missing it', async () => {
    const { actor, deps } = setup({
      startIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_ctx'),
        status: 'processing',
      },
      statusIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_ctx'),
        status: 'processing',
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({
      type: 'REFRESH',
      providerId: 'stripe',
    } as any);

    await waitForSnapshot(actor, (s) => s.value === 'fetchingStatusInvoke');
    await waitForSnapshot(actor, (s) => s.value === 'polling');

    expect(deps.getStatus).toHaveBeenCalledWith('stripe', {
      intentId: createPaymentIntentId('pi_ctx'),
    });
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
      intentId: createPaymentIntentId('ORDER_1'),
      returnUrl: 'https://return.test',
    });

    await waitForSnapshot(
      actor,
      (s) => s.value === 'afterConfirm' || s.value === 'polling' || s.value === 'done',
    );

    expect(deps.confirmPayment).toHaveBeenCalledWith('paypal', {
      intentId: createPaymentIntentId('ORDER_1'),
      returnUrl: 'https://return.test',
    });
  });

  it('CANCEL from idle uses event payload', async () => {
    const { actor, deps } = setup();

    actor.send({
      type: 'CANCEL',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_cancel'),
    });

    await waitForSnapshot(actor, (s) => s.value === 'cancelling');
    await waitForSnapshot(actor, (s) => s.value === 'done');

    expect(deps.cancelPayment).toHaveBeenCalledWith('stripe', {
      intentId: createPaymentIntentId('pi_cancel'),
    });
  });

  it('REFRESH fails when providerId is missing', async () => {
    const { actor, deps } = setup();

    actor.send({
      type: 'REFRESH',
      intentId: createPaymentIntentId('pi_missing_provider'),
    } as any);

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.hasTag('error')).toBe(true);
    expect(deps.getStatus).not.toHaveBeenCalled();
  });

  it('FALLBACK_REQUESTED -> fallbackConfirming', async () => {
    const { actor } = setup({ startReject: true });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'failed');

    actor.send({
      type: 'FALLBACK_REQUESTED',
      failedProviderId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
      mode: 'manual',
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'fallbackConfirming');
    expect(snap.hasTag('ready')).toBe(true);
    expect(snap.context.fallback.eligible).toBe(true);
  });

  it('status errors retry with backoff before failing', async () => {
    const { actor } = setup({
      statusReject: true,
      config: {
        polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 2 },
        statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 1 },
        processing: { maxDurationMs: 60 * 1000 },
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
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
        processing: { maxDurationMs: 60 * 1000 },
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'polling');

    actor.send({ type: 'REFRESH', providerId: 'stripe' } as any);

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed');
    expect(snap.hasTag('error')).toBe(true);
  });

  it('processing timeout: when policy bounds are exceeded, transitions to failed with processing_timeout', async () => {
    const { actor } = setup({
      initialContext: {
        flowContext: {
          flowId: 'flow_timeout',
          providerId: 'stripe',
          createdAt: 0,
          expiresAt: Date.now() + 60_000,
          providerRefs: { stripe: { paymentId: 'pi_processing' } },
        },
        providerId: 'stripe',
        intentId: createPaymentIntentId('pi_processing'),
      },
      statusIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_processing'),
        status: 'processing',
      },
      config: {
        polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 1 },
        statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
        processing: { maxDurationMs: 1 },
      },
    });

    actor.send({
      type: 'EXTERNAL_STATUS_UPDATED',
      payload: { providerId: 'stripe', referenceId: 'pi_processing' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed', 1500);
    expect(snap.hasTag('error')).toBe(true);
    expect(snap.context.error?.code).toBe('processing_timeout');
    expect(snap.context.error?.messageKey).toBe('errors.processing_timeout');
  });

  it('processing timeout from polling: when maxAttempts reached and pollDelay fires, transitions to failed with processing_timeout', async () => {
    vi.useFakeTimers({ now: 0 });
    const { actor } = setup({
      startIntent: { ...baseIntent, status: 'processing' },
      config: {
        polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 1 },
        statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
        processing: { maxDurationMs: 60_000 },
      },
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'polling');
    vi.advanceTimersToNextTimer();

    const snap = await waitForSnapshot(actor, (s) => s.value === 'failed', 200);
    expect(snap.hasTag('error')).toBe(true);
    expect(snap.context.error?.code).toBe('processing_timeout');
    expect(snap.context.error?.messageKey).toBe('errors.processing_timeout');

    vi.useRealTimers();
  });

  it('CIRCUIT_OPENED transitions to circuitOpen and then idle after cooldown', async () => {
    const { actor } = setup();

    actor.send({ type: 'CIRCUIT_OPENED', providerId: 'stripe', cooldownMs: 1 });

    await waitForSnapshot(actor, (s) => s.value === 'circuitOpen');
    await waitForSnapshot(actor, (s) => s.value === 'idle');
  });

  it('RATE_LIMITED transitions to rateLimited and then idle after cooldown', async () => {
    const { actor } = setup();

    actor.send({ type: 'RATE_LIMITED', providerId: 'stripe', cooldownMs: 1 });

    await waitForSnapshot(actor, (s) => s.value === 'rateLimited');
    await waitForSnapshot(actor, (s) => s.value === 'idle');
  });

  it('client confirm retries once on timeout before returning to requiresAction', async () => {
    vi.useFakeTimers();
    const { actor } = setup({
      startIntent: {
        ...baseIntent,
        status: 'requires_action',
        nextAction: { kind: 'client_confirm', token: 'tok_retry' },
      },
      clientConfirmError: createPaymentError('timeout', 'errors.timeout', undefined, null),
    });

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_123' },
        idempotencyKey: 'idem_flow_machine',
      },
    });

    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');

    actor.send({
      type: 'CONFIRM',
      providerId: 'stripe',
      intentId: createPaymentIntentId('pi_1'),
    });

    await waitForSnapshot(actor, (s) => s.value === 'clientConfirmRetrying');
    vi.advanceTimersByTime(500);

    await waitForSnapshot(actor, (s) => s.value === 'requiresAction');
    vi.useRealTimers();
  });

  it('finalize retries up to limit before pendingManualReview', async () => {
    vi.useFakeTimers();
    const { actor } = setup({
      finalizeReject: true,
    });

    actor.send({
      type: 'REDIRECT_RETURNED',
      payload: { providerId: 'stripe', referenceId: 'pi_finalize' },
    });

    await waitForSnapshot(actor, (s) => s.value === 'finalizing');

    // 5 retries (1s delay each) before pending manual review
    for (let i = 0; i < 5; i += 1) {
      await waitForSnapshot(actor, (s) => s.value === 'finalizeRetrying');
      vi.advanceTimersByTime(1000);
      await waitForSnapshot(actor, (s) => s.value === 'finalizing');
    }

    await waitForSnapshot(actor, (s) => s.value === 'pendingManualReview', 2000);
    vi.useRealTimers();
  });

  it('rehydrates context and reconciles external events on re-entry', async () => {
    const flowContext: PaymentFlowContext = {
      flowId: 'flow_reentry',
      providerId: 'stripe',
      providerRefs: { stripe: { intentId: createPaymentIntentId('pi_reentry').value } },
      createdAt: 1000,
      expiresAt: 2000,
    };

    const { actor, deps } = setup({
      initialContext: {
        flowContext,
        providerId: 'stripe',
        intentId: createPaymentIntentId('pi_reentry'),
      },

      statusIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_reentry'),
        status: 'succeeded',
      },
    });

    actor.send({
      type: 'WEBHOOK_RECEIVED',
      payload: { providerId: 'stripe', referenceId: 'pi_reentry' },
    });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done', 1500);

    expect(snap.context.flowContext?.flowId).toBe('flow_reentry');
    expect(deps.getStatus).toHaveBeenCalledWith('stripe', {
      intentId: createPaymentIntentId('pi_reentry'),
    });
  });

  it('dedupes EXTERNAL_STATUS_UPDATED events with same eventId', async () => {
    const { actor, deps } = setup({
      initialContext: {
        flowContext: {
          flowId: 'flow_ext_dedupe',
          providerId: 'stripe',
          providerRefs: { stripe: { paymentId: 'pi_ext' } },
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
        providerId: 'stripe',
        intentId: createPaymentIntentId('pi_ext'),
      },
      statusIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_ext'),
        status: 'succeeded',
      },
    });

    const payload = { providerId: 'stripe' as const, referenceId: 'pi_ext', eventId: 'evt_1' };

    actor.send({ type: 'EXTERNAL_STATUS_UPDATED', payload });
    actor.send({ type: 'EXTERNAL_STATUS_UPDATED', payload });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done', 1500);
    expect(snap.hasTag('ready')).toBe(true);
    expect(deps.getStatus).toHaveBeenCalledTimes(1);
  });

  it('dedupes WEBHOOK_RECEIVED events with same eventId', async () => {
    const { actor, deps } = setup({
      initialContext: {
        flowContext: {
          flowId: 'flow_webhook_dedupe',
          providerId: 'stripe',
          providerRefs: { stripe: { paymentId: 'pi_webhook_ext' } },
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
        },
        providerId: 'stripe',
        intentId: createPaymentIntentId('pi_webhook_ext'),
      },
      statusIntent: {
        ...baseIntent,
        id: createPaymentIntentId('pi_webhook_ext'),
        status: 'succeeded',
      },
    });

    const payload = {
      providerId: 'stripe' as const,
      referenceId: 'pi_webhook_ext',
      eventId: 'evt_webhook_1',
      raw: { id: 'evt_webhook_1' },
    };

    actor.send({ type: 'WEBHOOK_RECEIVED', payload });
    actor.send({ type: 'WEBHOOK_RECEIVED', payload });

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done', 1500);
    expect(snap.hasTag('ready')).toBe(true);
    expect(deps.getStatus).toHaveBeenCalledTimes(1);
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
        id: createPaymentIntentId('pi_swap'),
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
    expect(deps.getStatus).toHaveBeenCalledWith('stripe', {
      intentId: createPaymentIntentId('pay_1'),
    });
    expect(snap.context.flowContext?.providerRefs?.['stripe']?.preferenceId).toBe('pref_1');
    expect(snap.context.flowContext?.providerRefs?.['stripe']?.paymentId).toBe('pay_1');
  });
});
