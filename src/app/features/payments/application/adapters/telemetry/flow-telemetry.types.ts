/**
 * Flow telemetry event union for observability (PR6).
 * Minimal payloads; no sensitive data.
 */
export type FlowTelemetryEvent =
  | { kind: 'COMMAND_SENT'; eventType: string }
  | { kind: 'SYSTEM_EVENT_SENT'; eventType: string }
  | {
      kind: 'STATE_CHANGED';
      state: string;
      tags: string[];
      errorCode?: string;
    };

export interface FlowTelemetrySink {
  record(event: FlowTelemetryEvent): void;
}
