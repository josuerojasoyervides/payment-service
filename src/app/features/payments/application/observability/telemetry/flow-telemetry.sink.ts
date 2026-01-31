import { InjectionToken } from '@angular/core';

import type { FlowTelemetryEvent } from './flow-telemetry.event';

/**
 * Port for emitting flow telemetry events (PR6).
 * Payload must be sanitized by caller before calling emit.
 */
export interface FlowTelemetrySink {
  emit(event: FlowTelemetryEvent): void;
}

export const FLOW_TELEMETRY_SINK = new InjectionToken<FlowTelemetrySink>('FLOW_TELEMETRY_SINK');
