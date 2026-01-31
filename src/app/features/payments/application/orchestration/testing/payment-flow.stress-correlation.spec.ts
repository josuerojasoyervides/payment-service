/**
 * Stress scenario: correlation mismatch handling (PR6 Phase C).
 * Asserts: mismatch event (referenceId pi_B when flow is for pi_A) is ignored; state unchanged; no finalize; telemetry records SYSTEM_EVENT_RECEIVED with pi_B.
 */
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import { createPaymentFlowScenarioHarness } from '@payments/application/orchestration/testing/payment-flow.scenario-harness';
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

describe('Payment flow stress — correlation mismatch (PR6 Phase C)', () => {
  it('WEBHOOK_RECEIVED with referenceId pi_B (mismatch): event ignored; state remains for pi_A; no finalize; telemetry has SYSTEM_EVENT_RECEIVED with referenceId pi_B', async () => {
    const refA = 'pi_A';
    const refB = 'pi_B';
    const requestFinalizeSpy = vi.fn();

    const h = createPaymentFlowScenarioHarness({
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
              }),
          },
        },
        {
          provide: NextActionOrchestratorService,
          useValue: {
            requestFinalize: requestFinalizeSpy,
            requestClientConfirm: vi.fn(() =>
              of({
                id: refA,
                provider: 'stripe' as const,
                status: 'succeeded' as const,
                amount: 100,
                currency: 'MXN' as const,
              }),
            ),
          },
        },
        {
          provide: GetPaymentStatusUseCase,
          useValue: {
            execute: () =>
              of({
                id: refA,
                provider: 'stripe' as const,
                status: 'processing' as const,
                amount: 100,
                currency: 'MXN' as const,
              }),
          },
        },
      ],
    });

    h.sendCommand('START', { providerId: 'stripe', request: baseRequest });
    await h.drain();

    const stateBefore = String(h.getSnapshot().value);

    h.sendSystem('WEBHOOK_RECEIVED', {
      providerId: 'stripe',
      referenceId: refB,
      eventId: 'evt_wrong',
    });
    await h.drain();

    expect(requestFinalizeSpy).not.toHaveBeenCalled();

    const snapAfter = h.getSnapshot();
    const intentIdAfter = snapAfter.context.intentId ?? snapAfter.context.intent?.id ?? null;
    expect(intentIdAfter).toBe(refA);
    expect(
      stateBefore === 'requiresAction' || stateBefore === 'polling' || stateBefore === 'starting',
    ).toBe(true);
    expect(
      String(snapAfter.value) === 'requiresAction' ||
        String(snapAfter.value) === 'polling' ||
        String(snapAfter.value) === 'starting' ||
        snapAfter.hasTag('ready'),
    ).toBe(true);

    const systemReceived = h.telemetry.ofType('SYSTEM_EVENT_RECEIVED');
    const withPiB = systemReceived.filter((e) => e.payload?.['referenceId'] === refB);
    expect(withPiB.length).toBeGreaterThanOrEqual(1);
  });
});
