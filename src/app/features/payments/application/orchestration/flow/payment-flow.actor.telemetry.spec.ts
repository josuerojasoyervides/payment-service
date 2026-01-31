import { TestBed } from '@angular/core/testing';
import { PAYMENTS_FLOW_TELEMETRY_SINK } from '@payments/application/observability/telemetry/flow-telemetry.sink';
import { InMemoryTelemetrySink } from '@payments/application/observability/telemetry/sinks/in-memory-telemetry.sink';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import providePayments from '@payments/config/payment.providers';

async function waitForPolling(actor: PaymentFlowActorService, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (actor.snapshot().value !== 'polling') {
    if (Date.now() > deadline) throw new Error('Timeout waiting for polling');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('PaymentFlowActorService (PR6 Phase B telemetry)', () => {
  it('emits FLOW_STARTED, COMMAND_RECEIVED, and POLL_ATTEMPTED for START -> processing -> polling', async () => {
    const sink = new InMemoryTelemetrySink();
    TestBed.configureTestingModule({
      providers: [...providePayments(), { provide: PAYMENTS_FLOW_TELEMETRY_SINK, useValue: sink }],
    });
    const actor = TestBed.inject(PaymentFlowActorService);

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: 'o1',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_processing1234567890' },
      },
    });

    await waitForPolling(actor);

    const flowStarted = sink.ofType('FLOW_STARTED');
    const commandReceived = sink.ofType('COMMAND_RECEIVED');
    const pollAttempted = sink.ofType('POLL_ATTEMPTED');

    expect(flowStarted.length).toBeGreaterThanOrEqual(1);
    expect(commandReceived.length).toBeGreaterThanOrEqual(1);
    expect(pollAttempted.length).toBeGreaterThanOrEqual(1);
  });

  it('emits SYSTEM_EVENT_RECEIVED with allowlisted payload for WEBHOOK_RECEIVED', async () => {
    const sink = new InMemoryTelemetrySink();
    TestBed.configureTestingModule({
      providers: [...providePayments(), { provide: PAYMENTS_FLOW_TELEMETRY_SINK, useValue: sink }],
    });
    const actor = TestBed.inject(PaymentFlowActorService);

    actor.sendSystem({
      type: 'WEBHOOK_RECEIVED',
      payload: {
        providerId: 'stripe',
        referenceId: 'ref_123',
        eventId: 'ev_456',
        raw: { should: 'be filtered' },
      },
    });

    const last = sink.last('SYSTEM_EVENT_RECEIVED');
    expect(last).not.toBeNull();
    expect(last?.payload).not.toHaveProperty('raw');
    expect(last?.payload).toHaveProperty('providerId', 'stripe');
    expect(last?.payload).toHaveProperty('referenceId', 'ref_123');
    expect(last?.payload).toHaveProperty('eventId', 'ev_456');
  });
});
