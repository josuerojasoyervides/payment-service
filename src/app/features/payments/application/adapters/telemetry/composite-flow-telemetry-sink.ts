import type { FlowTelemetryEvent, FlowTelemetrySink } from './types/flow-telemetry.types';

/**
 * Sink that forwards every event to multiple sinks.
 * Use for dev: InMemory + Console; prod: Noop or external only.
 */
export class CompositeFlowTelemetrySink implements FlowTelemetrySink {
  constructor(private readonly sinks: FlowTelemetrySink[]) {}

  record(event: FlowTelemetryEvent): void {
    for (const sink of this.sinks) {
      sink.record(event);
    }
  }
}
