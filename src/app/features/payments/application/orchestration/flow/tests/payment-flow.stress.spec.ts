/**
 * Stress scenarios for payment flow (PR6.2): webhook dedupe, terminal safety,
 * finalize idempotency, correlation mismatch, processing timeout, out-of-order.
 * Uses scenario harness + telemetry; asserts providerId/refs and no duplicate side-effects.
 */
import { createScenarioHarness } from '@app/features/payments/application/api/testing/flow/payment-flow.harness';
import {
  PAYMENT_FLOW_CONFIG_OVERRIDES,
  PAYMENT_FLOW_INITIAL_CONTEXT,
} from '@payments/application/orchestration/flow/payment-flow/payment-flow-config.token';
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import { GetPaymentStatusUseCase } from '@payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/orchestration/use-cases/intent/start-payment.use-case';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { of } from 'rxjs';
import { vi } from 'vitest';

const baseRequest: CreatePaymentRequest = {
  orderId: 'o1',
  amount: 100,
  currency: 'MXN',
  method: { type: 'card' as const, token: 'tok_123' },
};

describe('Payment flow stress (PR6.2)', () => {
  describe('Scenario 1: webhook dedupe (same eventId)', () => {
    const webhookPayload = {
      providerId: 'stripe' as const,
      referenceId: 'pi_1',
      eventId: 'evt_1',
      raw: { id: 'evt_1' },
    };

    it('records two SYSTEM_EVENT_SENT for WEBHOOK_RECEIVED; flow converges; bounded reconciling', async () => {
      const harness = createScenarioHarness();
      harness.sendSystem('WEBHOOK_RECEIVED', webhookPayload);
      harness.sendSystem('WEBHOOK_RECEIVED', webhookPayload);
      await harness.flushMicrotasks();

      const events = harness.getTelemetryEvents();
      const systemSent = events.filter(
        (e) => e.kind === 'SYSTEM_EVENT_SENT' && e.eventType === 'WEBHOOK_RECEIVED',
      );
      expect(systemSent.length).toBe(2);

      const snapshot = harness.getSnapshot();
      expect(
        snapshot.hasTag('ready') || snapshot.hasTag('error') || snapshot.hasTag('loading'),
      ).toBe(true);

      const reconcilingCount = harness.countEvents(
        (e) =>
          e.kind === 'STATE_CHANGED' &&
          typeof e.state === 'string' &&
          e.state.includes('reconciling'),
      );
      expect(reconcilingCount).toBeLessThanOrEqual(2);
      const withRefs = events.filter((e) => e.kind === 'SYSTEM_EVENT_SENT' && e.refs?.['eventId']);
      expect(withRefs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scenario 2: external event after terminal does not reopen', () => {
    it('terminal state unchanged after WEBHOOK_RECEIVED (same eventId deduped); no transition back to reconciling/finalizing', async () => {
      const succeededIntent = {
        id: 'pi_terminal',
        provider: 'stripe' as const,
        status: 'succeeded' as const,
        amount: 100,
        currency: 'MXN' as const,
      };
      const h = createScenarioHarness({
        extraProviders: [
          {
            provide: GetPaymentStatusUseCase,
            useValue: { execute: () => of(succeededIntent) },
          },
        ],
      });
      h.sendSystem('EXTERNAL_STATUS_UPDATED', {
        providerId: 'stripe',
        referenceId: 'pi_terminal',
        eventId: 'evt_terminal',
      });
      for (let i = 0; i < 10; i++) await h.flushMicrotasks();

      const snapshotBefore = h.getSnapshot();
      const terminalStateValue = String(snapshotBefore.value);
      const hasTerminalTag = snapshotBefore.hasTag('ready') || snapshotBefore.hasTag('error');
      expect(hasTerminalTag).toBe(true);

      const reconcilingOrFinalizingBefore = h.countEvents(
        (e) =>
          e.kind === 'STATE_CHANGED' &&
          typeof e.state === 'string' &&
          (e.state.includes('reconciling') || e.state.includes('finalizing')),
      );

      h.sendSystem('WEBHOOK_RECEIVED', {
        providerId: 'stripe',
        referenceId: 'pi_terminal',
        eventId: 'evt_terminal',
      });
      await h.flushMicrotasks();

      const snapshotAfter = h.getSnapshot();
      expect(String(snapshotAfter.value)).toBe(terminalStateValue);
      expect(snapshotAfter.hasTag('ready') || snapshotAfter.hasTag('error')).toBe(true);

      const systemSentWebhook = h
        .getTelemetryEvents()
        .filter((e) => e.kind === 'SYSTEM_EVENT_SENT' && e.eventType === 'WEBHOOK_RECEIVED');
      expect(systemSentWebhook.length).toBeGreaterThanOrEqual(1);

      const reconcilingOrFinalizingAfter = h.countEvents(
        (e) =>
          e.kind === 'STATE_CHANGED' &&
          typeof e.state === 'string' &&
          (e.state.includes('reconciling') || e.state.includes('finalizing')),
      );
      expect(reconcilingOrFinalizingAfter).toBeLessThanOrEqual(reconcilingOrFinalizingBefore);
      const systemEvents = h.getTelemetryEvents().filter((e) => e.kind === 'SYSTEM_EVENT_SENT');
      expect(systemEvents.some((e) => e.providerId === 'stripe')).toBe(true);
    });
  });

  describe('Scenario 3: finalize idempotency (finalize runs once)', () => {
    it('REDIRECT_RETURNED + WEBHOOK_RECEIVED same ref: finalize called exactly once; flow converges', async () => {
      const refId = 'pi_final';
      const succeededIntent = {
        id: refId,
        provider: 'stripe' as const,
        status: 'succeeded' as const,
        amount: 100,
        currency: 'MXN' as const,
      };
      const requestFinalizeSpy = vi.fn(() => of(succeededIntent));
      const h = createScenarioHarness({
        extraProviders: [
          {
            provide: StartPaymentUseCase,
            useValue: {
              execute: () =>
                of({
                  ...succeededIntent,
                  status: 'requires_action' as const,
                }),
            },
          },
          {
            provide: NextActionOrchestratorService,
            useValue: {
              requestFinalize: requestFinalizeSpy,
              requestClientConfirm: vi.fn(() => of(succeededIntent)),
            },
          },
          {
            provide: GetPaymentStatusUseCase,
            useValue: { execute: () => of(succeededIntent) },
          },
        ],
      });
      h.sendCommand('START', { providerId: 'stripe', request: baseRequest });
      await h.flushMicrotasks(5);

      h.sendSystem('REDIRECT_RETURNED', { providerId: 'stripe', referenceId: refId });
      h.sendSystem('WEBHOOK_RECEIVED', {
        providerId: 'stripe',
        referenceId: refId,
        eventId: 'evt_final',
      });
      await h.flushMicrotasks(5);

      expect(requestFinalizeSpy).toHaveBeenCalledTimes(1);
      const snap = h.getSnapshot();
      expect(snap.hasTag('ready') || snap.hasTag('error') || snap.hasTag('loading')).toBe(true);
      const systemSent = h.getTelemetryEvents().filter((e) => e.kind === 'SYSTEM_EVENT_SENT');
      const redirectSent = systemSent.filter((e) => e.eventType === 'REDIRECT_RETURNED');
      const webhookSent = systemSent.filter((e) => e.eventType === 'WEBHOOK_RECEIVED');
      expect(redirectSent.length).toBeGreaterThanOrEqual(1);
      expect(webhookSent.length).toBeGreaterThanOrEqual(1);
      expect(redirectSent.every((e) => e.providerId === 'stripe')).toBe(true);
      expect(redirectSent.some((e) => e.refs?.['referenceId'] === refId)).toBe(true);
    });
  });

  describe('Scenario 4: correlation mismatch does not contaminate current flow', () => {
    it('REDIRECT_RETURNED with referenceId B (mismatch): no new reconciling/finalizing; noop or controlled error', async () => {
      const refA = 'pi_A';
      const refB = 'pi_B';
      const h = createScenarioHarness({
        extraProviders: [
          {
            provide: StartPaymentUseCase,
            useValue: {
              execute: () =>
                of({
                  id: refA,
                  provider: 'stripe' as const,
                  status: 'requires_action' as const,
                  amount: 100,
                  currency: 'MXN' as const,
                  providerRefs: { intentId: refA },
                }),
            },
          },
        ],
      });
      h.sendCommand('START', { providerId: 'stripe', request: baseRequest });
      await h.flushMicrotasks(5);

      const reconcilingFinalizingBefore = h.countEvents(
        (e) =>
          e.kind === 'STATE_CHANGED' &&
          typeof e.state === 'string' &&
          (e.state.includes('reconciling') || e.state.includes('finalizing')),
      );

      h.sendSystem('REDIRECT_RETURNED', { providerId: 'stripe', referenceId: refB });
      await h.flushMicrotasks(5);

      const reconcilingFinalizingAfter = h.countEvents(
        (e) =>
          e.kind === 'STATE_CHANGED' &&
          typeof e.state === 'string' &&
          (e.state.includes('reconciling') || e.state.includes('finalizing')),
      );
      expect(reconcilingFinalizingAfter).toBeLessThanOrEqual(reconcilingFinalizingBefore);
    });
  });

  describe('Scenario 5: processing timeout error stable', () => {
    it('when processing exceeds maxDurationMs, transitions to failed with processing_timeout and ERROR_RAISED', async () => {
      vi.useFakeTimers({ now: 0 });
      const flowId = 'flow_timeout_stress';
      const refId = 'pi_timeout';
      const processingIntent = {
        id: refId,
        provider: 'stripe' as const,
        status: 'processing' as const,
        amount: 100,
        currency: 'MXN' as const,
      };
      const h = createScenarioHarness({
        extraProviders: [
          {
            provide: PAYMENT_FLOW_CONFIG_OVERRIDES,
            useValue: {
              processing: { maxDurationMs: 1 },
              polling: { baseDelayMs: 1, maxDelayMs: 1, maxAttempts: 1 },
              statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
            },
          },
          {
            provide: PAYMENT_FLOW_INITIAL_CONTEXT,
            useValue: {
              flowContext: {
                flowId,
                providerId: 'stripe',
                createdAt: 0,
                expiresAt: 10_000,
                providerRefs: { stripe: { intentId: refId } },
              },
              providerId: 'stripe',
              intentId: refId,
            },
          },
          {
            provide: GetPaymentStatusUseCase,
            useValue: { execute: () => of(processingIntent) },
          },
        ],
      });
      h.sendSystem('EXTERNAL_STATUS_UPDATED', {
        providerId: 'stripe',
        referenceId: refId,
        eventId: 'evt_timeout',
      });
      h.tick(2);
      await h.flushMicrotasks(5);

      const snap = h.getSnapshot();
      expect(snap.hasTag('error')).toBe(true);
      expect(snap.context.error?.code).toBe('processing_timeout');

      const errorRaised = h
        .getTelemetryEvents()
        .filter((e) => e.kind === 'ERROR_RAISED' && e.errorCode === 'processing_timeout');
      expect(errorRaised.length).toBeGreaterThanOrEqual(1);
      expect(errorRaised[0].flowId).toBe(flowId);
      expect(errorRaised[0].providerId).toBe('stripe');

      vi.useRealTimers();
    });
  });

  describe('Scenario 6: terminal safety (no re-open)', () => {
    it('out-of-order events after terminal do not revive; state stays terminal', async () => {
      const succeededIntent = {
        id: 'pi_done',
        provider: 'stripe' as const,
        status: 'succeeded' as const,
        amount: 100,
        currency: 'MXN' as const,
      };
      const h = createScenarioHarness({
        extraProviders: [
          { provide: GetPaymentStatusUseCase, useValue: { execute: () => of(succeededIntent) } },
        ],
      });
      h.sendSystem('WEBHOOK_RECEIVED', {
        providerId: 'stripe',
        referenceId: 'pi_done',
        eventId: 'evt_1',
      });
      for (let i = 0; i < 15; i++) await h.flushMicrotasks();
      const terminalValue = String(h.getSnapshot().value);
      expect(
        h.getSnapshot().hasTag('ready') || h.getSnapshot().hasTag('error'),
        'flow should reach terminal (ready or error)',
      ).toBe(true);

      h.sendSystem('EXTERNAL_STATUS_UPDATED', {
        providerId: 'stripe',
        referenceId: 'pi_done',
        eventId: 'evt_2',
      });
      h.sendSystem('REDIRECT_RETURNED', { providerId: 'stripe', referenceId: 'pi_done' });
      for (let i = 0; i < 10; i++) await h.flushMicrotasks();

      expect(String(h.getSnapshot().value)).toBe(terminalValue);
      expect(h.getSnapshot().hasTag('ready') || h.getSnapshot().hasTag('error')).toBe(true);
    });
  });
});
