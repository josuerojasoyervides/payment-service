import type { FlowTelemetryEvent } from '@payments/application/observability/telemetry/flow-telemetry.event';
import type { FlowTelemetrySink } from '@payments/application/observability/telemetry/flow-telemetry.sink';

/**
 * Logs event type and correlation fields to console (dev only).
 * Payload must already be sanitized by caller.
 */
export class ConsoleTelemetrySink implements FlowTelemetrySink {
  emit(event: FlowTelemetryEvent): void {
    const { type, flowId, referenceId, providerId, timestampMs } = event;

    console.log('[FlowTelemetry]', { type, flowId, referenceId, providerId, timestampMs });
  }
}
