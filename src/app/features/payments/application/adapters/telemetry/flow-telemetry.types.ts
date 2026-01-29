/**
 * Flow telemetry event union for observability (PR6).
 * Minimal payloads; no sensitive data.
 * All events include atMs; flowId/status when available from context.
 */
export type FlowTelemetryEvent =
  | { kind: 'COMMAND_SENT'; eventType: string; atMs: number; flowId?: string }
  | { kind: 'SYSTEM_EVENT_SENT'; eventType: string; atMs: number; flowId?: string }
  | {
      kind: 'STATE_CHANGED';
      state: string;
      tags: string[];
      errorCode?: string;
      status?: string;
      atMs: number;
      flowId?: string;
    };

export interface FlowTelemetrySink {
  record(event: FlowTelemetryEvent): void;
}
