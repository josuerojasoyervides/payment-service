import type { FlowTelemetryEvent } from '@payments/application/observability/telemetry/flow-telemetry.event';

import { InMemoryTelemetrySink } from './in-memory-telemetry.sink';

function event(
  type: FlowTelemetryEvent['type'],
  overrides?: Partial<FlowTelemetryEvent>,
): FlowTelemetryEvent {
  return {
    type,
    timestampMs: Date.now(),
    flowId: 'flow-1',
    referenceId: null,
    providerId: null,
    stateNode: null,
    tags: [],
    attempt: null,
    payload: null,
    ...overrides,
  };
}

describe('InMemoryTelemetrySink', () => {
  it('stores events', () => {
    const sink = new InMemoryTelemetrySink();
    sink.emit(event('FLOW_STARTED'));
    sink.emit(event('COMMAND_RECEIVED'));
    expect(sink.all()).toHaveLength(2);
    expect(sink.all()[0].type).toBe('FLOW_STARTED');
    expect(sink.all()[1].type).toBe('COMMAND_RECEIVED');
  });

  it('last(type) works', () => {
    const sink = new InMemoryTelemetrySink();
    sink.emit(event('FLOW_STARTED'));
    sink.emit(event('COMMAND_RECEIVED'));
    sink.emit(event('COMMAND_RECEIVED', { flowId: 'flow-2' }));
    expect(sink.last('FLOW_STARTED')).not.toBeNull();
    expect(sink.last('FLOW_STARTED')?.flowId).toBe('flow-1');
    expect(sink.last('COMMAND_RECEIVED')).not.toBeNull();
    expect(sink.last('COMMAND_RECEIVED')?.flowId).toBe('flow-2');
    expect(sink.last('FLOW_FAILED')).toBeNull();
  });

  it('ofType(type) returns matching events', () => {
    const sink = new InMemoryTelemetrySink();
    sink.emit(event('COMMAND_RECEIVED'));
    sink.emit(event('FLOW_SUCCEEDED'));
    sink.emit(event('COMMAND_RECEIVED'));
    const received = sink.ofType('COMMAND_RECEIVED');
    expect(received).toHaveLength(2);
    expect(sink.ofType('FLOW_FAILED')).toHaveLength(0);
  });

  it('clear works', () => {
    const sink = new InMemoryTelemetrySink();
    sink.emit(event('FLOW_STARTED'));
    sink.clear();
    expect(sink.all()).toHaveLength(0);
    expect(sink.last('FLOW_STARTED')).toBeNull();
  });
});
