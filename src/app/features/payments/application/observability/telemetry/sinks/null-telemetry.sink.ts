import type { FlowTelemetryEvent } from '@payments/application/observability/telemetry/flow-telemetry.event';
import type { FlowTelemetrySink } from '@payments/application/observability/telemetry/flow-telemetry.sink';

export class NullTelemetrySink implements FlowTelemetrySink {
  emit(_event: FlowTelemetryEvent): void {
    // no-op
  }
}
