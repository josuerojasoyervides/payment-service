import type { FlowTelemetryEvent, FlowTelemetrySink } from './flow-telemetry.types';

export class NoopFlowTelemetrySink implements FlowTelemetrySink {
  record(_event: FlowTelemetryEvent): void {
    // no-op
  }
}
