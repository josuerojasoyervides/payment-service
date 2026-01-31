// composite-flow-telemetry-sink.ts
import { inject, Injectable } from '@angular/core';
import { FLOW_TELEMETRY_SINKS } from '@app/features/payments/application/api/tokens/telemetry/flow-telemetry-sink.token';

import type { FlowTelemetryEvent, FlowTelemetrySink } from './types/flow-telemetry.types';

/**
 * Sink that forwards every event to multiple sinks.
 * Guardrail: telemetry must never break the flow — failures are swallowed per-sink.
 */
@Injectable()
export class CompositeFlowTelemetrySink implements FlowTelemetrySink {
  private readonly sinks = inject<readonly FlowTelemetrySink[]>(FLOW_TELEMETRY_SINKS);

  record(event: FlowTelemetryEvent): void {
    for (const sink of this.sinks) {
      try {
        sink.record(event);
      } catch {
        // Intentionally swallow: telemetry must not affect runtime behavior.
      }
    }
  }
}
