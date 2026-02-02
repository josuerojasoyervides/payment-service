/**
 * Mega stress scenario (PR6 Phase D): duplicates + delays + out-of-order events.
 * Asserts: convergence, finalize idempotency, telemetry timeline (new kinds/refs), no secrets in meta.
 */
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import { scheduleDelayedWebhook } from '@payments/application/orchestration/testing/fakes/delayed-webhook.fake';
import { createFlakyStatusUseCaseFake } from '@payments/application/orchestration/testing/fakes/flaky-status-use-case.fake';
import { createPaymentFlowScenarioHarness } from '@payments/application/orchestration/testing/payment-flow.scenario-harness';
import { GetPaymentStatusUseCase } from '@payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/orchestration/use-cases/intent/start-payment.use-case';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { of } from 'rxjs';
import { vi } from 'vitest';

const baseRequest: CreatePaymentRequest = {
  orderId: 'o1',
  money: { amount: 100, currency: 'MXN' },
  method: { type: 'card' as const, token: 'tok_visa1234567890abcdef' },
};

const FORBIDDEN_PAYLOAD_KEYS = ['raw', 'clientSecret', 'token', 'email'];

describe('Payment flow mega chaos (PR6 Phase D)', () => {
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
  it('START + REDIRECT_RETURNED + delayed webhook + duplicate now + advance + REFRESH: finalize once, flow converges, telemetry has COMMAND_SENT/SYSTEM_EVENT_SENT, no secrets in meta', async () => {
    const refId = 'pi_mega';
    const succeededIntent = {
      id: refId,
      provider: 'stripe' as const,
      status: 'succeeded' as const,
      money: { amount: 100, currency: 'MXN' as const },
    };
    const requestFinalizeSpy = vi.fn(() => of(succeededIntent));

    const harness = createPaymentFlowScenarioHarness({
      useFakeTimers: true,
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
          useValue: createFlakyStatusUseCaseFake({
            statusSequence: ['processing', 'succeeded'],
            intentId: refId,
            providerId: 'stripe',
          }),
        },
      ],
    });

    harness.sendCommand('START', { providerId: 'stripe', request: baseRequest });
    await harness.drain();

    harness.sendSystem('REDIRECT_RETURNED', { providerId: 'stripe', referenceId: refId });

    const webhookPayload = { providerId: 'stripe' as const, referenceId: refId, eventId: 'evt_1' };
    scheduleDelayedWebhook((p) => harness.sendSystem('WEBHOOK_RECEIVED', p), webhookPayload, 200);
    harness.sendSystem('WEBHOOK_RECEIVED', webhookPayload);

    harness.advance(200);
    harness.sendCommand('REFRESH');
    await harness.drain();

    expect(requestFinalizeSpy).toHaveBeenCalledTimes(1);

    const snap = harness.getSnapshot();
    expect(snap.hasTag('failed')).toBe(false);
    expect(snap.hasTag('done') || snap.hasTag('ready') || harness.state.isReady()).toBe(true);

    const commandSent = harness.telemetry.ofKind('COMMAND_SENT');
    expect(commandSent.length).toBeGreaterThanOrEqual(1);
    const hasStartCommand = harness.telemetry
      .ofKind('COMMAND_SENT')
      .some((e) => e.kind === 'COMMAND_SENT' && e.eventType === 'START');
    expect(hasStartCommand).toBe(true);

    const systemSent = harness.telemetry.ofKind('SYSTEM_EVENT_SENT');
    expect(systemSent.length).toBeGreaterThanOrEqual(2);
    const withRef = systemSent.filter((e) => e.refs?.['referenceId'] === refId);
    expect(withRef.length).toBeGreaterThanOrEqual(1);

    for (const event of harness.telemetry.getEvents()) {
      const meta = 'meta' in event ? event.meta : undefined;
      if (meta && typeof meta === 'object') {
        for (const key of FORBIDDEN_PAYLOAD_KEYS) {
          expect(meta).not.toHaveProperty(key);
        }
      }
    }
  });
});
