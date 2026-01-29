/**
 * Stress scenarios for payment flow (PR6.2): webhook dedupe, terminal no-reopen.
 * Uses scenario harness + telemetry; assertions are invariant-based (tags, counts).
 */
import { GetPaymentStatusUseCase } from '@payments/application/orchestration/use-cases/get-payment-status.use-case';
import { of } from 'rxjs';

import { createScenarioHarness } from './payment-flow.scenario-harness';

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
    });
  });
});
