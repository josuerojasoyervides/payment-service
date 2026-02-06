import { TestBed } from '@angular/core/testing';
import { InMemoryFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/dev-only/in-memory-flow-telemetry-sink';
import { FLOW_TELEMETRY_SINK } from '@app/features/payments/application/api/tokens/telemetry/flow-telemetry-sink.token';
import { createOrderId } from '@payments/application/api/testing/vo-test-helpers';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import providePayments from '@payments/config/payment.providers';

async function waitForPolling(actor: PaymentFlowActorService, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (actor.snapshot().value !== 'polling') {
    if (Date.now() > deadline) throw new Error('Timeout waiting for polling');
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function waitForState(
  actor: PaymentFlowActorService,
  state: string,
  timeoutMs = 3000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (String(actor.snapshot().value) !== state) {
    if (Date.now() > deadline) throw new Error(`Timeout waiting for ${state}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

const FORBIDDEN_KEYS = ['raw', 'clientSecret', 'token', 'email'];

describe('PaymentFlowActorService (PR6 flow telemetry)', () => {
  it('emits COMMAND_SENT (eventType START) and STATE_CHANGED (state polling) for START -> processing -> polling', async () => {
    const sink = new InMemoryFlowTelemetrySink();
    TestBed.configureTestingModule({
      providers: [...providePayments(), { provide: FLOW_TELEMETRY_SINK, useValue: sink }],
    });
    const actor = TestBed.inject(PaymentFlowActorService);

    actor.send({
      type: 'START',
      providerId: 'stripe',
      request: {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card', token: 'tok_processing1234567890' },
        idempotencyKey: 'idem_flow_telemetry',
      },
    });

    await waitForPolling(actor);

    const commandSent = sink.ofKind('COMMAND_SENT');
    const hasStart = commandSent.some((e) => e.kind === 'COMMAND_SENT' && e.eventType === 'START');
    expect(hasStart).toBe(true);

    const stateChanged = sink.ofKind('STATE_CHANGED');
    const hasPolling = stateChanged.some(
      (e) => e.kind === 'STATE_CHANGED' && e.state === 'polling',
    );
    expect(hasPolling).toBe(true);
  });

  it('emits SYSTEM_EVENT_SENT with refs for WEBHOOK_RECEIVED; no secrets in meta or refs', async () => {
    const sink = new InMemoryFlowTelemetrySink();
    TestBed.configureTestingModule({
      providers: [...providePayments(), { provide: FLOW_TELEMETRY_SINK, useValue: sink }],
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

    const systemSent = sink.ofKind('SYSTEM_EVENT_SENT');
    const webhook = systemSent.find(
      (e) => e.kind === 'SYSTEM_EVENT_SENT' && e.eventType === 'WEBHOOK_RECEIVED',
    );
    expect(webhook).toBeDefined();
    expect(webhook?.refs?.['referenceId']).toBe('ref_123');
    expect(webhook?.refs?.['eventId']).toBe('ev_456');

    for (const event of sink.getEvents()) {
      const refs = 'refs' in event ? event.refs : undefined;
      if (refs && typeof refs === 'object') {
        for (const key of FORBIDDEN_KEYS) {
          expect(refs).not.toHaveProperty(key);
        }
      }
      const meta = 'meta' in event ? event.meta : undefined;
      if (meta && typeof meta === 'object') {
        for (const key of FORBIDDEN_KEYS) {
          expect(meta).not.toHaveProperty(key);
        }
      }
    }
  });

  it('emits RESILIENCE_EVENT when circuit opens', async () => {
    const sink = new InMemoryFlowTelemetrySink();
    TestBed.configureTestingModule({
      providers: [...providePayments(), { provide: FLOW_TELEMETRY_SINK, useValue: sink }],
    });
    const actor = TestBed.inject(PaymentFlowActorService);

    actor.sendSystem({ type: 'CIRCUIT_OPENED', providerId: 'stripe', cooldownMs: 1 });
    await waitForState(actor, 'circuitOpen');

    const resilienceEvents = sink.ofKind('RESILIENCE_EVENT');
    const hasCircuitOpened = resilienceEvents.some(
      (e) => e.kind === 'RESILIENCE_EVENT' && e.eventType === 'CIRCUIT_OPENED',
    );
    expect(hasCircuitOpened).toBe(true);
  });
});
