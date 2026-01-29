import type { FlowTelemetryEvent, FlowTelemetrySink } from './flow-telemetry.types';

export class InMemoryFlowTelemetrySink implements FlowTelemetrySink {
  private readonly events: FlowTelemetryEvent[] = [];

  record(event: FlowTelemetryEvent): void {
    this.events.push(event);
  }

  getEvents(): readonly FlowTelemetryEvent[] {
    return this.events;
  }
}
