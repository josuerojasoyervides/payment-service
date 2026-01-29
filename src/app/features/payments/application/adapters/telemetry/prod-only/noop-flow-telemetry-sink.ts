import type {
  FlowTelemetryEvent,
  FlowTelemetrySink,
} from '@payments/application/adapters/telemetry/types/flow-telemetry.types';

export class NoopFlowTelemetrySink implements FlowTelemetrySink {
  record(_event: FlowTelemetryEvent): void {
    // no-op
  }
}
