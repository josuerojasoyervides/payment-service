import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

/**
 * Provider-agnostic flow telemetry event types (PR6).
 * JSON-serializable; no UI or infrastructure imports.
 */
export type FlowTelemetryEventType =
  | 'FLOW_STARTED'
  | 'COMMAND_RECEIVED'
  | 'SYSTEM_EVENT_RECEIVED'
  | 'INTENT_UPDATED'
  | 'POLL_ATTEMPTED'
  | 'FINALIZE_REQUESTED'
  | 'FINALIZE_SKIPPED'
  | 'FALLBACK_STATUS'
  | 'FLOW_SUCCEEDED'
  | 'FLOW_FAILED';

export interface FlowTelemetryEvent {
  type: FlowTelemetryEventType;
  timestampMs: number;
  flowId: string;
  referenceId: string | null;
  providerId: PaymentProviderId | null;
  stateNode: string | null;
  tags: string[];
  attempt: number | null;
  /** Must be sanitized before passing to sink. */
  payload: Record<string, unknown> | null;
}
