import { TestBed } from '@angular/core/testing';
import { FLOW_TELEMETRY_SINK } from '@payments/application/adapters/telemetry/flow-telemetry-sink.token';
import { InMemoryFlowTelemetrySink } from '@payments/application/adapters/telemetry/in-memory-flow-telemetry-sink';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import providePayments from '@payments/config/payment.providers';

describe('Flow telemetry (PR6.1 smoke)', () => {
  it('records COMMAND_SENT and STATE_CHANGED when actor receives a command', () => {
    const sink = new InMemoryFlowTelemetrySink();

    TestBed.configureTestingModule({
      providers: [...providePayments(), { provide: FLOW_TELEMETRY_SINK, useValue: sink }],
    });

    const actor = TestBed.inject(PaymentFlowActorService);
    actor.send({ type: 'RESET' });

    const events = sink.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.kind === 'STATE_CHANGED')).toBe(true);
  });
});
