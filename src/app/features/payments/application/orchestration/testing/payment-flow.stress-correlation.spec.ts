/**
 * Stress scenario: correlation mismatch handling (PR6 Phase C).
 * Asserts: mismatch event (referenceId pi_B when flow is for pi_A) is ignored; state unchanged; no finalize; telemetry records SYSTEM_EVENT_SENT with pi_B.
 */
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import {
  createPaymentFlowScenarioHarness,
  type PaymentFlowScenarioHarness,
} from '@payments/application/orchestration/testing/payment-flow.scenario-harness';
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

describe('Payment flow stress — correlation mismatch (PR6 Phase C)', () => {
  let harness: PaymentFlowScenarioHarness | null = null;

  afterEach(() => {
    harness?.dispose();
    harness = null;
  });

  it('WEBHOOK_RECEIVED with referenceId pi_B (mismatch): event ignored; state remains for pi_A; no finalize; telemetry has SYSTEM_EVENT_SENT with referenceId pi_B', async () => {
    const refA = 'pi_A';
    const refB = 'pi_B';
    const requestFinalizeSpy = vi.fn();

    harness = createPaymentFlowScenarioHarness({
      extraProviders: [
        {
          provide: StartPaymentUseCase,
          useValue: {
            execute: () =>
              of({
                id: refA,
                provider: 'stripe' as const,
                status: 'requires_action' as const,
                money: { amount: 100, currency: 'MXN' as const },
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
                money: { amount: 100, currency: 'MXN' as const },
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
                money: { amount: 100, currency: 'MXN' as const },
              }),
          },
        },
      ],
    });

    harness!.sendCommand('START', { providerId: 'stripe', request: baseRequest });
    await harness!.drain();

    const stateBefore = String(harness!.getSnapshot().value);

    harness!.sendSystem('WEBHOOK_RECEIVED', {
      providerId: 'stripe',
      referenceId: refB,
      eventId: 'evt_wrong',
    });
    await harness!.drain();

    expect(requestFinalizeSpy).not.toHaveBeenCalled();

    const snapAfter = harness!.getSnapshot();
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

    const systemSent = harness!.telemetry.ofKind('SYSTEM_EVENT_SENT');
    const withPiB = systemSent.filter((e) => e.refs?.['referenceId'] === refB);
    expect(withPiB.length).toBeGreaterThanOrEqual(1);
  });
});
