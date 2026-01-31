import type {
  FlowTelemetryEvent,
  FlowTelemetryEventType,
} from '@payments/application/observability/telemetry/flow-telemetry.event';
import type { FlowTelemetrySink } from '@payments/application/observability/telemetry/flow-telemetry.sink';

export class InMemoryTelemetrySink implements FlowTelemetrySink {
  private readonly events: FlowTelemetryEvent[] = [];

  emit(event: FlowTelemetryEvent): void {
    this.events.push(event);
  }

  all(): FlowTelemetryEvent[] {
    return [...this.events];
  }

  ofType(type: FlowTelemetryEventType): FlowTelemetryEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  last(type: FlowTelemetryEventType): FlowTelemetryEvent | null {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i].type === type) return this.events[i];
    }
    return null;
  }

  clear(): void {
    this.events.length = 0;
  }
}
