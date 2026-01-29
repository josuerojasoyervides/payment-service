import { TestBed } from '@angular/core/testing';
import { InMemoryFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/dev-only/in-memory-flow-telemetry-sink';
import { FLOW_TELEMETRY_SINK } from '@payments/application/api/tokens/telemetry/flow-telemetry-sink.token';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import providePayments from '@payments/config/payment.providers';

describe('Flow telemetry', () => {
  it('records COMMAND_SENT and STATE_CHANGED with atMs when actor receives a command', () => {
    const sink = new InMemoryFlowTelemetrySink();

    TestBed.configureTestingModule({
      providers: [...providePayments(), { provide: FLOW_TELEMETRY_SINK, useValue: sink }],
    });

    const actor = TestBed.inject(PaymentFlowActorService);
    actor.send({ type: 'RESET' });

    const events = sink.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);
    events.forEach((e) => expect(e.atMs).toBeDefined());
    const stateChanged = events.filter((e) => e.kind === 'STATE_CHANGED');
    expect(stateChanged.length).toBeGreaterThanOrEqual(1);
    stateChanged.forEach((e) => expect(e.atMs).toBeDefined());
  });
});
