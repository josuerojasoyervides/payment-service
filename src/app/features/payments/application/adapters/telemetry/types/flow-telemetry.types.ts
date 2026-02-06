/**
 * Flow telemetry event envelope (PR6).
 * All events: flowId, providerId?, refs/correlation, type, state/tag, timestamp, meta.
 * No secrets, no raw PII — redaction applied before recording.
 */
export type FlowTelemetryRefs = Record<string, string | undefined>;

export type FlowTelemetryEvent =
  | {
      kind: 'COMMAND_SENT';
      eventType: string;
      atMs: number;
      flowId?: string;
      providerId?: string;
      refs?: FlowTelemetryRefs;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'SYSTEM_EVENT_SENT';
      eventType: string;
      atMs: number;
      flowId?: string;
      providerId?: string;
      refs?: FlowTelemetryRefs;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'RESILIENCE_EVENT';
      eventType:
        | 'CIRCUIT_OPENED'
        | 'CIRCUIT_CLOSED'
        | 'CIRCUIT_HALF_OPEN'
        | 'RETRY_ATTEMPTED'
        | 'RETRY_EXHAUSTED'
        | 'RATE_LIMIT_HIT';
      atMs: number;
      flowId?: string;
      providerId?: string;
      refs?: FlowTelemetryRefs;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'STATE_CHANGED';
      state: string;
      tags: string[];
      errorCode?: string;
      status?: string;
      atMs: number;
      flowId?: string;
      providerId?: string;
      refs?: FlowTelemetryRefs;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'EFFECT_START';
      effect: string;
      atMs: number;
      flowId?: string;
      providerId?: string;
      refs?: FlowTelemetryRefs;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'EFFECT_FINISH';
      effect: string;
      atMs: number;
      flowId?: string;
      providerId?: string;
      refs?: FlowTelemetryRefs;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'ERROR_RAISED';
      errorCode: string;
      atMs: number;
      flowId?: string;
      providerId?: string;
      refs?: FlowTelemetryRefs;
      meta?: Record<string, unknown>;
    };

export interface FlowTelemetrySink {
  record(event: FlowTelemetryEvent): void;
}
