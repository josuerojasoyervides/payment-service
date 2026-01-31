/**
 * Stress scenario: finalize idempotency under duplicate/out-of-order events (PR6 Phase C).
 * Asserts: finalize side-effect called exactly once; flow converges; telemetry contains expected SYSTEM_EVENT_RECEIVED.
 */
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import {
  createPaymentFlowScenarioHarness,
  type PaymentFlowScenarioHarness,
} from '@payments/application/orchestration/testing/payment-flow.scenario-harness';
import { GetPaymentStatusUseCase } from '@payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/orchestration/use-cases/intent/start-payment.use-case';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import { of } from 'rxjs';
import { vi } from 'vitest';

const baseRequest: CreatePaymentRequest = {
  orderId: 'o1',
  amount: 100,
  currency: 'MXN',
  method: { type: 'card' as const, token: 'tok_visa1234567890abcdef' },
};

describe('Payment flow stress — finalize idempotency (PR6 Phase C)', () => {
  let harness: PaymentFlowScenarioHarness | null = null;

  afterEach(() => {
    harness?.dispose();
    harness = null;
  });

  it('REDIRECT_RETURNED + WEBHOOK_RECEIVED + duplicate WEBHOOK: finalize called exactly once; flow converges; telemetry has SYSTEM_EVENT_RECEIVED', async () => {
    const refId = 'pi_123';
    const succeededIntent = {
      id: refId,
      provider: 'stripe' as const,
      status: 'succeeded' as const,
      amount: 100,
      currency: 'MXN' as const,
    };
    const requestFinalizeSpy = vi.fn(() => of(succeededIntent));

    harness = createPaymentFlowScenarioHarness({
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

    harness!.sendCommand('START', { providerId: 'stripe', request: baseRequest });
    await harness!.drain();

    harness!.sendSystem('REDIRECT_RETURNED', { providerId: 'stripe', referenceId: refId });
    harness!.sendSystem('WEBHOOK_RECEIVED', {
      providerId: 'stripe',
      referenceId: refId,
      eventId: 'evt_1',
    });
    harness!.sendSystem('WEBHOOK_RECEIVED', {
      providerId: 'stripe',
      referenceId: refId,
      eventId: 'evt_1',
    });
    await harness!.drain();

    expect(requestFinalizeSpy).toHaveBeenCalledTimes(1);

    const snap = harness!.getSnapshot();
    expect(snap.hasTag('done') || snap.hasTag('ready') || harness!.state.isReady()).toBe(true);

    const systemReceived = harness!.telemetry.ofType('SYSTEM_EVENT_RECEIVED');
    expect(systemReceived.length).toBeGreaterThanOrEqual(1);
    const withRef = systemReceived.filter((e) => e.payload?.['referenceId'] === refId);
    expect(withRef.length).toBeGreaterThanOrEqual(1);
  });
});
